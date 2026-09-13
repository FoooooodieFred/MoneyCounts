/**
 * OpenAI 兼容 Chat Completions 同源代理。
 * 浏览器把用户自己的 Key 放在 Authorization；本函数只转发，不落盘。
 */
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
  tools?: LlmToolDefinition[];
  toolChoice?: "auto" | "none";
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MAX_MESSAGES = 48;
const MAX_MESSAGE_CHARS = 20_000;
/** 表格导入等长输出；供应商若更低会自行截断或报错。 */
export const MAX_COMPLETION_TOKENS = 16_384;
const REQUEST_TIMEOUT_MS = 120_000;

export const normalizeChatCompletionsUrl = (baseUrl: string) => {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/chatcompletion_v2$/i.test(trimmed)) return trimmed;
  try {
    const { pathname } = new URL(trimmed);
    const path = pathname.replace(/\/+$/, "") || "/";
    // 已是完整 endpoint（如 MiniMax /v1/text/chatcompletion_v2），不再拼 /chat/completions
    if (path !== "/" && path !== "/v1" && !path.endsWith("/v1")) return trimmed;
  } catch {
    /* fall through */
  }
  return `${trimmed}/chat/completions`;
};

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

export const handleLlmChatRequest = async (request: Request): Promise<Response> => {
  const apiKey =
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? "";
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
  const tools = Array.isArray(body.tools) ? body.tools : [];
  const hasTools = tools.length > 0;
  if (hasTools) {
    payload.tools = tools.slice(0, 16);
    if (body.toolChoice === "none" || body.toolChoice === "auto") {
      payload.tool_choice = body.toolChoice;
    }
  }
  if (body.jsonMode === true || (body.jsonMode !== false && !hasTools)) {
    payload.response_format = { type: "json_object" };
  }
  if (typeof body.maxTokens === "number" && body.maxTokens > 0) {
    payload.max_tokens = Math.min(Math.floor(body.maxTokens), MAX_COMPLETION_TOKENS);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(normalizeChatCompletionsUrl(body.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json; charset=utf-8",
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
