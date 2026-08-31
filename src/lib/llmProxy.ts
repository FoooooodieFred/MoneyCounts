/**
 * OpenAI 兼容 Chat Completions 同源代理。
 * 浏览器把用户自己的 Key 放在 Authorization；本函数只转发，不落盘。
 */
export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatProxyBody = {
  baseUrl: string;
  model: string;
  messages: LlmChatMessage[];
  temperature?: number;
  jsonMode?: boolean;
  maxTokens?: number;
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 20_000;
const REQUEST_TIMEOUT_MS = 45_000;

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

const isChatRole = (value: unknown): value is LlmChatMessage["role"] =>
  value === "system" || value === "user" || value === "assistant";

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
    if (!message || !isChatRole(message.role) || typeof message.content !== "string") {
      return jsonError("message.role / content 无效。", 400);
    }
    if (message.content.length > MAX_MESSAGE_CHARS) {
      return jsonError("单条 message 过长。", 400);
    }
  }

  const payload: Record<string, unknown> = {
    model: body.model.trim(),
    messages: body.messages.map((item) => ({ role: item.role, content: item.content })),
    temperature: typeof body.temperature === "number" ? body.temperature : 0,
    stream: false,
  };
  if (body.jsonMode !== false) {
    payload.response_format = { type: "json_object" };
  }
  if (typeof body.maxTokens === "number" && body.maxTokens > 0) {
    payload.max_tokens = Math.min(Math.floor(body.maxTokens), 4096);
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
