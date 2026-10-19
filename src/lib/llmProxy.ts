/**
 * OpenAI 兼容 Chat Completions 同源代理。
 * 浏览器把用户自己的 Key 放在 Authorization；本函数只转发，不落盘。
 *
 * 同时支持三种接口风格：OpenAI Chat Completions、OpenAI Responses、Anthropic Messages。
 * 三种风格在这里被统一成同一种响应结构，浏览器侧只认一种格式。
 */
import type { LlmApiStyle } from "./llmApiSettings";

export type LlmChatRole = "system" | "user" | "assistant" | "tool";

export type LlmToolCallPayload = {
  id: string;
  type?: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type LlmChatMessage = {
  role: LlmChatRole;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCallPayload[];
};

export type LlmToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type LlmChatProxyBody = {
  baseUrl: string;
  model: string;
  messages: LlmChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
  topP?: number;
  tools?: LlmToolDefinition[];
  toolChoice?: "auto" | "none";
  apiStyle?: LlmApiStyle;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

/** 归一化后的用量，各风格统一成这套字段。 */
export type LlmUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MAX_MESSAGES = 48;
const MAX_MESSAGE_CHARS = 20_000;
/** 表格导入等长输出；供应商若更低会自行截断或报错。 */
export const MAX_COMPLETION_TOKENS = 16_384;
/** Anthropic 的 max_tokens 是必填项，没配就给一个够用的默认值。 */
const ANTHROPIC_DEFAULT_MAX_TOKENS = 8_192;
const REQUEST_TIMEOUT_MS = 120_000;

const ENDPOINT_BY_STYLE: Record<LlmApiStyle, string> = {
  "chat-completions": "/chat/completions",
  responses: "/responses",
  anthropic: "/messages",
};

export const resolveUpstreamUrl = (baseUrl: string, style: LlmApiStyle = "chat-completions") => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const endpoint = ENDPOINT_BY_STYLE[style];
  if (new RegExp(`${endpoint.replace(/\//g, "\\/")}$`, "i").test(trimmed)) return trimmed;
  // MiniMax 之类的完整 endpoint，不再拼接
  if (style === "chat-completions" && /\/chatcompletion_v2$/i.test(trimmed)) return trimmed;
  try {
    const { pathname } = new URL(trimmed);
    const path = pathname.replace(/\/+$/, "") || "/";
    // 已是完整 endpoint（如 MiniMax /v1/text/chatcompletion_v2），不再拼 /chat/completions
    if (path !== "/" && path !== "/v1" && !path.endsWith("/v1")) return trimmed;
  } catch {
    /* fall through */
  }
  return `${trimmed}${endpoint}`;
};

/** 旧接口保留：等价于 chat-completions 风格。 */
export const normalizeChatCompletionsUrl = (baseUrl: string) =>
  resolveUpstreamUrl(baseUrl, "chat-completions");

export const isAllowedLlmBaseUrl = (baseUrl: string) => {
  try {
    const url = new URL(baseUrl.trim());
    if (url.username || url.password) return false;
    if (url.protocol === "https:") return Boolean(url.hostname);
    if (url.protocol === "http:") return LOCAL_HOSTS.has(url.hostname);
    return false;
  } catch {
    return false;
  }
};

const jsonError = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const isChatRole = (value: unknown): value is LlmChatRole =>
  value === "system" || value === "user" || value === "assistant" || value === "tool";

const normalizeMessageContent = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return null;
};

const sanitizeToolCalls = (value: unknown): LlmToolCallPayload[] | undefined => {
  if (!Array.isArray(value) || !value.length) return undefined;
  const calls: LlmToolCallPayload[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    const name = record.function?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    const args = record.function?.arguments;
    calls.push({
      id:
        typeof record.id === "string" && record.id.trim() ? record.id : `call_${calls.length + 1}`,
      type: "function",
      function: {
        name: name.trim(),
        arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}),
      },
    });
  }
  return calls.length ? calls : undefined;
};

const safeExtraHeaders = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const name = key.trim();
    if (!name) continue;
    if (typeof item !== "string" && typeof item !== "number") continue;
    // 不允许覆盖鉴权与内容类型头，否则会破坏代理本身的约定
    if (/^(authorization|x-api-key|content-type|host)$/i.test(name)) continue;
    out[name] = String(item);
  }
  return out;
};

const safeExtraBody = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const name = key.trim();
    if (!name) continue;
    // 这些字段由本代理控制，交给用户覆盖会破坏请求
    if (/^(model|messages|input|stream|authorization)$/i.test(name)) continue;
    out[name] = item;
  }
  return out;
};

const buildAuthHeaders = (apiKey: string, style: LlmApiStyle): Record<string, string> => {
  if (style === "anthropic") {
    return { "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  }
  return { Authorization: `Bearer ${apiKey}` };
};

/* ------------------------------ 风格：chat-completions ------------------------------ */

const buildChatCompletionsPayload = (body: LlmChatProxyBody, hasTools: boolean) => {
  const payload: Record<string, unknown> = {
    model: body.model.trim(),
    messages: body.messages.map((item) => {
      const next: Record<string, unknown> = { role: item.role, content: item.content };
      if (item.name) next.name = item.name;
      if (item.tool_call_id) next.tool_call_id = item.tool_call_id;
      if (item.tool_calls?.length) next.tool_calls = sanitizeToolCalls(item.tool_calls);
      return next;
    }),
    temperature: typeof body.temperature === "number" ? body.temperature : 0,
    stream: false,
  };
  if (typeof body.topP === "number") payload.top_p = body.topP;
  if (hasTools) {
    payload.tools = (body.tools ?? []).slice(0, 16);
    if (body.toolChoice === "none" || body.toolChoice === "auto") {
      payload.tool_choice = body.toolChoice;
    }
  } else if (body.jsonMode === true || body.jsonMode !== false) {
    payload.response_format = { type: "json_object" };
  }
  if (typeof body.maxTokens === "number" && body.maxTokens > 0) {
    payload.max_tokens = Math.min(Math.floor(body.maxTokens), MAX_COMPLETION_TOKENS);
  }
  return { ...payload, ...safeExtraBody(body.extraBody) };
};

/* --------------------------------- 风格：responses --------------------------------- */

const buildResponsesPayload = (body: LlmChatProxyBody, hasTools: boolean) => {
  const system = body.messages
    .filter((item) => item.role === "system")
    .map((item) => item.content)
    .join("\n\n");
  const input = body.messages
    .filter((item) => item.role !== "system")
    .map((item) => {
      if (item.role === "assistant" && item.tool_calls?.length) {
        return {
          role: "assistant",
          content: item.content,
          tool_calls: item.tool_calls.map((call) => ({
            id: call.id,
            type: "function",
            call: { name: call.function.name, arguments: call.function.arguments },
          })),
        };
      }
      if (item.role === "tool") {
        return {
          role: "tool",
          content: item.content,
          tool_call_id: item.tool_call_id ?? "",
        };
      }
      return { role: item.role, content: item.content };
    });

  const payload: Record<string, unknown> = {
    model: body.model.trim(),
    input,
    stream: false,
  };
  if (system) payload.instructions = system;
  if (typeof body.temperature === "number") payload.temperature = body.temperature;
  if (typeof body.topP === "number") payload.top_p = body.topP;
  if (typeof body.maxTokens === "number" && body.maxTokens > 0) {
    payload.max_output_tokens = Math.min(Math.floor(body.maxTokens), MAX_COMPLETION_TOKENS);
  }
  if (hasTools) {
    payload.tools = (body.tools ?? []).slice(0, 16).map((tool) => ({
      type: "function",
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
    if (body.toolChoice === "none" || body.toolChoice === "auto") {
      payload.tool_choice = body.toolChoice;
    }
  } else if (body.jsonMode === true || body.jsonMode !== false) {
    payload.text = { format: { type: "json_object" } };
  }
  return { ...payload, ...safeExtraBody(body.extraBody) };
};

/* -------------------------------- 风格：anthropic -------------------------------- */

const buildAnthropicPayload = (body: LlmChatProxyBody, hasTools: boolean) => {
  const system = body.messages
    .filter((item) => item.role === "system")
    .map((item) => item.content)
    .join("\n\n");
  const messages = body.messages
    .filter((item) => item.role !== "system")
    .map((item) => {
      if (item.role === "assistant" && item.tool_calls?.length) {
        return {
          role: "assistant",
          content: [
            ...(item.content ? [{ type: "text", text: item.content }] : []),
            ...item.tool_calls.map((call) => ({
              type: "tool_use",
              id: call.id,
              name: call.function.name,
              input: safeJsonParse(call.function.arguments),
            })),
          ],
        };
      }
      if (item.role === "tool") {
        return {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: item.tool_call_id ?? "",
              content: item.content,
            },
          ],
        };
      }
      return { role: item.role, content: item.content };
    });

  const payload: Record<string, unknown> = {
    model: body.model.trim(),
    messages,
    max_tokens:
      typeof body.maxTokens === "number" && body.maxTokens > 0
        ? Math.min(Math.floor(body.maxTokens), MAX_COMPLETION_TOKENS)
        : ANTHROPIC_DEFAULT_MAX_TOKENS,
  };
  if (system) payload.system = system;
  if (typeof body.temperature === "number") payload.temperature = body.temperature;
  if (typeof body.topP === "number") payload.top_p = body.topP;
  if (hasTools) {
    payload.tools = (body.tools ?? []).slice(0, 16).map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));
    if (body.toolChoice === "none" || body.toolChoice === "auto") {
      payload.tool_choice = body.toolChoice === "none" ? { type: "none" } : { type: "auto" };
    }
  }
  return { ...payload, ...safeExtraBody(body.extraBody) };
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
};

/* ------------------------------- 响应归一化 ------------------------------- */

const readNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const usageFromChat = (payload: unknown): LlmUsage | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = readNumber(record.prompt_tokens);
  const completion = readNumber(record.completion_tokens);
  const total = readNumber(record.total_tokens) || prompt + completion;
  if (!prompt && !completion && !total) return undefined;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
};

const usageFromResponses = (payload: unknown): LlmUsage | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = readNumber(record.input_tokens);
  const completion = readNumber(record.output_tokens);
  const total = readNumber(record.total_tokens) || prompt + completion;
  if (!prompt && !completion && !total) return undefined;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
};

const usageFromAnthropic = (payload: unknown): LlmUsage | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return undefined;
  const record = usage as Record<string, unknown>;
  const prompt = readNumber(record.input_tokens);
  const completion = readNumber(record.output_tokens);
  const total = prompt + completion;
  if (!prompt && !completion) return undefined;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
};

const normalizeChatCompletionsResponse = (payload: unknown) => {
  const usage = usageFromChat(payload);
  return { payload: (payload ?? {}) as Record<string, unknown>, usage };
};

const normalizeResponsesResponse = (payload: unknown) => {
  const usage = usageFromResponses(payload);
  if (!payload || typeof payload !== "object") {
    return { payload: { choices: [] }, usage };
  }
  const root = payload as {
    output?: unknown;
    output_text?: unknown;
    choices?: unknown;
  };
  let text = typeof root.output_text === "string" ? root.output_text : "";
  const toolCalls: LlmToolCallPayload[] = [];
  if (Array.isArray(root.output)) {
    for (const item of root.output) {
      if (!item || typeof item !== "object") continue;
      const record = item as {
        type?: unknown;
        content?: unknown;
        name?: unknown;
        arguments?: unknown;
        call_id?: unknown;
        id?: unknown;
      };
      if (record.type === "function_call") {
        toolCalls.push({
          id: (record.call_id as string) || (record.id as string) || `call_${toolCalls.length + 1}`,
          type: "function",
          function: {
            name: (record.name as string) ?? "",
            arguments: (record.arguments as string) ?? "{}",
          },
        });
        continue;
      }
      if (record.type === "message" && Array.isArray(record.content)) {
        for (const part of record.content) {
          if (!part || typeof part !== "object") continue;
          const chunk = part as { type?: unknown; text?: unknown };
          if (chunk.type === "output_text" && typeof chunk.text === "string") text += chunk.text;
        }
      }
    }
  }
  return {
    payload: {
      choices: [{ message: { content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }],
    },
    usage,
  };
};

const normalizeAnthropicResponse = (payload: unknown) => {
  const usage = usageFromAnthropic(payload);
  if (!payload || typeof payload !== "object") {
    return { payload: { choices: [] }, usage };
  }
  const root = payload as { content?: unknown; stop_reason?: unknown };
  let text = "";
  const toolCalls: LlmToolCallPayload[] = [];
  if (Array.isArray(root.content)) {
    for (const part of root.content) {
      if (!part || typeof part !== "object") continue;
      const record = part as { type?: unknown; text?: unknown; id?: unknown; name?: unknown; input?: unknown };
      if (record.type === "text" && typeof record.text === "string") {
        text += record.text;
        continue;
      }
      if (record.type === "tool_use") {
        toolCalls.push({
          id: (record.id as string) || `call_${toolCalls.length + 1}`,
          type: "function",
          function: {
            name: (record.name as string) ?? "",
            arguments: JSON.stringify(record.input ?? {}),
          },
        });
      }
    }
  }
  return {
    payload: {
      choices: [{ message: { content: text, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) } }],
    },
    usage,
  };
};

/* --------------------------------- 请求处理 --------------------------------- */

const readApiKey = (request: Request) =>
  (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    request.headers.get("x-api-key")?.trim() ??
    ""
  );

export const handleLlmChatRequest = async (request: Request): Promise<Response> => {
  const apiKey = readApiKey(request);
  if (!apiKey) return jsonError("缺少 API Key。", 401);

  let body: LlmChatProxyBody;
  try {
    body = (await request.json()) as LlmChatProxyBody;
  } catch {
    return jsonError("请求体不是合法 JSON。", 400);
  }

  if (!body || typeof body !== "object") return jsonError("请求体无效。", 400);
  if (typeof body.baseUrl !== "string" || !body.baseUrl.trim()) {
    return jsonError("请提供 API Base URL。", 400);
  }
  if (!isAllowedLlmBaseUrl(body.baseUrl)) {
    return jsonError("API 地址只允许 https，或本机 http://localhost。", 400);
  }
  if (typeof body.model !== "string" || !body.model.trim()) {
    return jsonError("请提供模型名。", 400);
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonError("messages 不能为空。", 400);
  }
  if (body.messages.length > MAX_MESSAGES) return jsonError("messages 过多。", 400);

  for (const message of body.messages) {
    const content = normalizeMessageContent(message?.content);
    if (!message || !isChatRole(message.role) || content == null) {
      return jsonError("message.role / content 无效。", 400);
    }
    if (content.length > MAX_MESSAGE_CHARS) {
      return jsonError("单条 message 过长。", 400);
    }
    message.content = content;
  }

  const style: LlmApiStyle = body.apiStyle ?? "chat-completions";
  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  const payload =
    style === "responses"
      ? buildResponsesPayload(body, hasTools)
      : style === "anthropic"
        ? buildAnthropicPayload(body, hasTools)
        : buildChatCompletionsPayload(body, hasTools);

  const headers: Record<string, string> = {
    ...buildAuthHeaders(apiKey, style),
    "Content-Type": "application/json",
    Accept: "application/json",
    ...safeExtraHeaders(body.extraHeaders),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(resolveUpstreamUrl(body.baseUrl, style), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    // 上游报错时原样回传，让浏览器看到供应商自己的错误信息
    if (!upstream.ok) {
      return new Response(text || JSON.stringify({ error: `上游返回 ${upstream.status}` }), {
        status: upstream.status,
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const normalized =
      style === "responses"
        ? normalizeResponsesResponse(parsed)
        : style === "anthropic"
          ? normalizeAnthropicResponse(parsed)
          : normalizeChatCompletionsResponse(parsed);

    const outBody: Record<string, unknown> = { ...normalized.payload };
    if (normalized.usage) outBody.usage = normalized.usage;
    return new Response(JSON.stringify(outBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return jsonError(aborted ? "模型请求超时。" : "无法连接模型接口。", aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 模型列表发现。多数 OpenAI 兼容服务在 `{baseUrl}/models` 下返回 `{ data: [{ id }] }`。
 */
export const handleLlmModelsRequest = async (request: Request): Promise<Response> => {
  const apiKey = readApiKey(request);
  if (!apiKey) return jsonError("缺少 API Key。", 401);

  const url = new URL(request.url);
  const baseUrl = url.searchParams.get("baseUrl") ?? "";
  const style = (url.searchParams.get("apiStyle") ?? "chat-completions") as LlmApiStyle;
  if (!baseUrl.trim()) return jsonError("请提供 API Base URL。", 400);
  if (!isAllowedLlmBaseUrl(baseUrl)) {
    return jsonError("API 地址只允许 https，或本机 http://localhost。", 400);
  }

  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  const modelsUrl = /\/models$/i.test(trimmed) ? trimmed : `${trimmed}/models`;
  const headers: Record<string, string> = {
    ...buildAuthHeaders(apiKey, style),
    Accept: "application/json",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const upstream = await fetch(modelsUrl, { headers, signal: controller.signal });
    const text = await upstream.text();
    if (!upstream.ok) {
      return jsonError(
        `拉取模型列表失败（${upstream.status}）。可以手动填写模型名。`,
        upstream.status,
      );
    }
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return jsonError("模型列表不是合法 JSON。", 502);
    }
    const models = extractModelIds(parsed);
    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return jsonError(
      aborted ? "拉取模型列表超时。" : "无法连接模型接口。",
      aborted ? 504 : 502,
    );
  } finally {
    clearTimeout(timer);
  }
};

export const extractModelIds = (payload: unknown): string[] => {
  const ids: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const name = value.trim();
    if (name && !ids.includes(name)) ids.push(name);
  };
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        const record = item as { id?: unknown; name?: unknown; model?: unknown };
        push(record.id ?? record.model ?? record.name);
      }
    }
  } else if (payload && typeof payload === "object") {
    const root = payload as { data?: unknown; models?: unknown };
    for (const key of ["data", "models"] as const) {
      const list = root[key];
      if (Array.isArray(list)) {
        for (const item of list) {
          if (typeof item === "string") push(item);
          else if (item && typeof item === "object") {
            const record = item as { id?: unknown; name?: unknown; model?: unknown };
            push(record.id ?? record.model ?? record.name);
          }
        }
      }
    }
  }
  return ids;
};
