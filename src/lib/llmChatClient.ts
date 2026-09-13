import type { LlmChatMessage, LlmToolCallPayload, LlmToolDefinition } from "./llmProxy";
import type { LlmApiSettings } from "./llmApiSettings";

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type LlmChatCompletion = {
  content: string;
  toolCalls: LlmToolCall[];
  raw: unknown;
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
  tools?: LlmToolDefinition[];
  toolChoice?: "auto" | "none";
  signal?: AbortSignal;
  allowEmptyContent?: boolean;
}): Promise<LlmChatCompletion> => {
  const { settings, messages } = options;
  const jsonMode = options.jsonMode ?? (options.tools?.length ? false : settings.jsonMode);
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
      temperature: options.temperature ?? 0,
      jsonMode,
      maxTokens: options.maxTokens,
      tools: options.tools,
      toolChoice: options.toolChoice,
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
    throw new Error(readErrorMessage(payload, `模型接口返回 ${response.status}`));
  }

  const content = contentFromCompletion(payload).trim();
  const toolCalls = toolCallsFromCompletion(payload);
  if (!content && !toolCalls.length && !options.allowEmptyContent) {
    throw new Error("模型没有返回内容。");
  }
  return { content, toolCalls, raw: payload };
};

export const testLlmConnection = async (settings: LlmApiSettings) => {
  await requestLlmChat({
    settings,
    messages: [{ role: "user", content: "Reply with the single word pong." }],
    jsonMode: false,
    maxTokens: 8,
    temperature: 0,
  });
};
