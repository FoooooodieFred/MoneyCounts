import type { LlmChatMessage, LlmToolCallPayload, LlmToolDefinition, LlmUsage } from "./llmProxy";
import type { LlmApiSettings } from "./llmApiSettings";
import { recordLlmUsage, type LlmUsageScene } from "./llmUsage";

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type LlmChatCompletion = {
  content: string;
  toolCalls: LlmToolCall[];
  raw: unknown;
  /** 上游报的用量；没报就由调用方估算。 */
  usage: LlmUsage | null;
};

const readErrorMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as {
    error?: unknown;
    message?: unknown;
    base_resp?: { status_msg?: unknown; status_code?: unknown };
  };
  if (record.base_resp && typeof record.base_resp === "object") {
    const statusMsg = record.base_resp.status_msg;
    if (typeof statusMsg === "string" && statusMsg.trim()) return statusMsg;
    const statusCode = record.base_resp.status_code;
    if (typeof statusCode === "number" && statusCode !== 0) {
      return `MiniMax 错误码 ${statusCode}`;
    }
  }
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as { message?: unknown };
    if (typeof nested.message === "string" && nested.message.trim()) return nested.message;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
};

const contentFromCompletion = (payload: unknown) => {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  if (typeof message?.content === "string") return message.content;
  return "";
};

const toolCallsFromCompletion = (payload: unknown): LlmToolCall[] => {
  if (!payload || typeof payload !== "object") return [];
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return [];
  const message = (
    choices[0] as {
      message?: {
        tool_calls?: LlmToolCallPayload[];
        function_call?: { name?: unknown; arguments?: unknown };
      };
    }
  ).message;
  const calls = message?.tool_calls;
  if (Array.isArray(calls) && calls.length) {
    return calls
      .map((item, index) => ({
        id: item.id || `call_${index + 1}`,
        name: item.function?.name ?? "",
        arguments: item.function?.arguments ?? "{}",
      }))
      .filter((item) => item.name);
  }
  const fn = message?.function_call;
  if (fn && typeof fn.name === "string" && fn.name.trim()) {
    return [
      {
        id: "call_1",
        name: fn.name.trim(),
        arguments: typeof fn.arguments === "string" ? fn.arguments : "{}",
      },
    ];
  }
  return [];
};

export const requestLlmChat = async (options: {
  settings: LlmApiSettings;
  messages: LlmChatMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: LlmToolDefinition[];
  toolChoice?: "auto" | "none";
  signal?: AbortSignal;
  allowEmptyContent?: boolean;
  /** 记到 Token 看台时归到哪一栏。 */
  scene?: LlmUsageScene;
}): Promise<LlmChatCompletion> => {
  const { settings, messages } = options;
  const scene = options.scene ?? "agent";
  const jsonMode = options.jsonMode ?? (options.tools?.length ? false : settings.jsonMode);
  const started = Date.now();
  const response = await fetch("/api/llm/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      baseUrl: settings.baseUrl,
      model: settings.model,
      messages,
      apiStyle: settings.apiStyle,
      temperature: options.temperature ?? settings.temperature,
      topP: options.topP ?? settings.topP ?? undefined,
      jsonMode,
      maxTokens: options.maxTokens ?? settings.maxTokens ?? undefined,
      tools: options.tools,
      toolChoice: options.toolChoice,
      extraHeaders: settings.extraHeaders,
      extraBody: settings.extraBody,
    }),
    signal: options.signal,
  });

  const rawText = await response.text();
  let payload: unknown;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = { error: rawText.slice(0, 400) };
  }

  if (!response.ok) {
    const message = readErrorMessage(payload, `模型接口返回 ${response.status}`);
    recordLlmUsage({
      settings,
      scene,
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
      messages,
    });
    throw new Error(message);
  }

  const content = contentFromCompletion(payload).trim();
  const toolCalls = toolCallsFromCompletion(payload);
  if (!content && !toolCalls.length && !options.allowEmptyContent) {
    const message = "模型没有返回内容。";
    recordLlmUsage({
      settings,
      scene,
      ok: false,
      latencyMs: Date.now() - started,
      error: message,
      messages,
    });
    throw new Error(message);
  }
  const usage = usageFromCompletion(payload);
  recordLlmUsage({
    settings,
    scene,
    ok: true,
    latencyMs: Date.now() - started,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    totalTokens: usage?.total_tokens,
    estimated: usage === null,
    messages,
    responseText: content,
  });
  return { content, toolCalls, raw: payload, usage };
};

export const testLlmConnection = async (settings: LlmApiSettings) => {
  await requestLlmChat({
    settings,
    messages: [{ role: "user", content: "Reply with the single word pong." }],
    jsonMode: false,
    maxTokens: 8,
    temperature: 0,
    scene: "test",
  });
};

/** 读取上游返回的 usage；三种接口风格都被代理归一化成了同一套字段。 */
export const usageFromCompletion = (payload: unknown): LlmUsage | null => {
  if (!payload || typeof payload !== "object") return null;
  const usage = (payload as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  const prompt = typeof record.prompt_tokens === "number" ? record.prompt_tokens : 0;
  const completion = typeof record.completion_tokens === "number" ? record.completion_tokens : 0;
  const total =
    typeof record.total_tokens === "number" && record.total_tokens > 0
      ? record.total_tokens
      : prompt + completion;
  if (!prompt && !completion && !total) return null;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: total };
};

/** 拉取该接口可用的模型列表。 */
export const fetchLlmModels = async (settings: LlmApiSettings): Promise<string[]> => {
  const query = new URLSearchParams({
    baseUrl: settings.baseUrl,
    apiStyle: settings.apiStyle,
  });
  const response = await fetch(`/api/llm/models?${query.toString()}`, {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  });
  const rawText = await response.text();
  let payload: unknown = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(readErrorMessage(payload, `拉取模型列表失败（${response.status}）`));
  }
  const models = (payload as { models?: unknown })?.models;
  return Array.isArray(models) ? models.filter((item): item is string => typeof item === "string") : [];
};
