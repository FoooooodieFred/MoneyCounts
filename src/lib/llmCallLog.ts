/**
 * 最近一次 LLM 调用日志。存在 sessionStorage，关浏览器即丢。
 * 不写密钥、不写完整账单原文。
 */
export const LLM_CALL_LOG_KEY = "monthly-smart-ledger:llm-call-log:v1";
export const LLM_CALL_LOG_LIMIT = 20;

export type LlmCallLogEntry = {
  at: number;
  model: string;
  host: string;
  ok: boolean;
  latencyMs: number;
  inputChars: number;
  entryCount?: number;
  error?: string;
};

const isLogEntry = (value: unknown): value is LlmCallLogEntry => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LlmCallLogEntry>;
  return (
    typeof item.at === "number" &&
    typeof item.model === "string" &&
    typeof item.host === "string" &&
    typeof item.ok === "boolean" &&
    typeof item.latencyMs === "number" &&
    typeof item.inputChars === "number"
  );
};

const storage = () => (typeof sessionStorage === "undefined" ? null : sessionStorage);

export const readLlmCallLog = (): LlmCallLogEntry[] => {
  try {
    const raw = JSON.parse(storage()?.getItem(LLM_CALL_LOG_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isLogEntry).slice(0, LLM_CALL_LOG_LIMIT);
  } catch {
    return [];
  }
};

export const appendLlmCallLog = (entry: LlmCallLogEntry) => {
  const next = [entry, ...readLlmCallLog()].slice(0, LLM_CALL_LOG_LIMIT);
  storage()?.setItem(LLM_CALL_LOG_KEY, JSON.stringify(next));
  return next;
};

export const clearLlmCallLog = () => {
  storage()?.removeItem(LLM_CALL_LOG_KEY);
};

export const clearLlmSessionContext = () => {
  clearLlmCallLog();
};

export const hostFromBaseUrl = (baseUrl: string) => {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
};
