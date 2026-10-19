/**
 * LLM token 用量记录。存在本机 LocalStorage，供「Token 看台」统计。
 * 不记密钥，也不记账单原文；只记模型、场景、token 数与耗时。
 */
import { kvGet, kvSet } from "./kv";
import { estimateLlmCost, type LlmApiSettings } from "./llmApiSettings";
import { LLM_USAGE_KEY } from "./storageKeys";

export { LLM_USAGE_KEY };

/** 保留的记录条数上限。 */
export const LLM_USAGE_LIMIT = 500;

export type LlmUsageScene = "parse" | "templates" | "import" | "agent" | "test";

export const LLM_USAGE_SCENE_LABELS: Record<LlmUsageScene, string> = {
  parse: "自然语言记账",
  templates: "快捷模板",
  import: "表格导入",
  agent: "MoneyMore 对话",
  test: "连通测试",
};

export type LlmUsageRecord = {
  at: number;
  profileId: string;
  profileName: string;
  provider: string;
  model: string;
  scene: LlmUsageScene;
  ok: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** true 表示 token 数是估算的（上游没报 usage）。 */
  estimated: boolean;
  cost: number | null;
  error?: string;
};

export type LlmUsageTotals = {
  calls: number;
  okCalls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number | null;
};

export type LlmUsageSummary = LlmUsageTotals & {
  byModel: Array<{
    model: string;
    profileName: string;
    calls: number;
    totalTokens: number;
    cost: number | null;
  }>;
  byScene: Array<{ scene: LlmUsageScene; calls: number; totalTokens: number }>;
  byDay: Array<{ day: string; calls: number; totalTokens: number }>;
};

const isRecord = (value: unknown): value is LlmUsageRecord => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<LlmUsageRecord>;
  return (
    typeof item.at === "number" &&
    typeof item.model === "string" &&
    typeof item.scene === "string" &&
    typeof item.ok === "boolean" &&
    typeof item.latencyMs === "number" &&
    typeof item.promptTokens === "number" &&
    typeof item.completionTokens === "number" &&
    typeof item.totalTokens === "number"
  );
};

/** 粗略估算 token 数：CJK 约 1 字 1 token，其余约 4 字符 1 token。 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xac00 && code <= 0xd7af) ||
      (code >= 0xf900 && code <= 0xfaff)
    ) {
      cjk += 1;
    } else {
      other += 1;
    }
  }
  return Math.ceil(cjk + other / 4);
};

const dayKey = (at: number) => {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const readLlmUsage = (): LlmUsageRecord[] => {
  try {
    const raw = JSON.parse(kvGet(LLM_USAGE_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isRecord).slice(0, LLM_USAGE_LIMIT);
  } catch {
    return [];
  }
};

const listeners = new Set<() => void>();

/** Token 看台订阅用量变化。 */
export const subscribeLlmUsage = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = () => {
  for (const listener of listeners) listener();
};

export const appendLlmUsage = (record: LlmUsageRecord): LlmUsageRecord[] => {
  const next = [record, ...readLlmUsage()].slice(0, LLM_USAGE_LIMIT);
  kvSet(LLM_USAGE_KEY, JSON.stringify(next));
  notify();
  return next;
};

export const clearLlmUsage = () => {
  kvSet(LLM_USAGE_KEY, "[]");
  notify();
};

/** 记录一次调用；`usage` 来自上游，没报就用字符数估算。 */
export const recordLlmUsage = (options: {
  settings: LlmApiSettings;
  scene: LlmUsageScene;
  ok: boolean;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimated?: boolean;
  error?: string;
  messages?: Array<{ role: string; content: string }>;
  responseText?: string;
}): LlmUsageRecord => {
  const { settings, scene } = options;
  const promptFromMessages = options.messages
    ? estimateTokens(options.messages.map((item) => item.content).join("\n"))
    : 0;
  const promptTokens = options.promptTokens ?? promptFromMessages;
  const completionTokens =
    options.completionTokens ??
    (options.responseText ? estimateTokens(options.responseText) : 0);
  const totalTokens = options.totalTokens ?? promptTokens + completionTokens;
  const estimated = options.estimated ?? (options.promptTokens === undefined);
  const record: LlmUsageRecord = {
    at: Date.now(),
    profileId: settings.profileId,
    profileName: settings.profileName,
    provider: settings.provider,
    model: settings.model,
    scene,
    ok: options.ok,
    latencyMs: options.latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    estimated,
    cost: estimateLlmCost(settings, promptTokens, completionTokens),
    ...(options.error ? { error: options.error } : {}),
  };
  appendLlmUsage(record);
  return record;
};

const addTotals = (totals: LlmUsageTotals, record: LlmUsageRecord) => {
  totals.calls += 1;
  if (record.ok) totals.okCalls += 1;
  else totals.failedCalls += 1;
  totals.promptTokens += record.promptTokens;
  totals.completionTokens += record.completionTokens;
  totals.totalTokens += record.totalTokens;
  if (record.cost !== null) {
    totals.cost = (totals.cost ?? 0) + record.cost;
  }
};

/** 汇总用量。`now` 可注入，便于测试。 */
export const summarizeLlmUsage = (records: LlmUsageRecord[]): LlmUsageSummary => {
  const totals: LlmUsageTotals = {
    calls: 0,
    okCalls: 0,
    failedCalls: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    cost: null,
  };
  const modelMap = new Map<string, { model: string; profileName: string; calls: number; totalTokens: number; cost: number | null }>();
  const sceneMap = new Map<LlmUsageScene, { scene: LlmUsageScene; calls: number; totalTokens: number }>();
  const dayMap = new Map<string, { day: string; calls: number; totalTokens: number }>();

  for (const record of records) {
    addTotals(totals, record);

    const modelKey = `${record.profileId}::${record.model}`;
    const model = modelMap.get(modelKey) ?? {
      model: record.model,
      profileName: record.profileName,
      calls: 0,
      totalTokens: 0,
      cost: null,
    };
    model.calls += 1;
    model.totalTokens += record.totalTokens;
    if (record.cost !== null) model.cost = (model.cost ?? 0) + record.cost;
    modelMap.set(modelKey, model);

    const scene = sceneMap.get(record.scene) ?? {
      scene: record.scene,
      calls: 0,
      totalTokens: 0,
    };
    scene.calls += 1;
    scene.totalTokens += record.totalTokens;
    sceneMap.set(record.scene, scene);

    const day = dayKey(record.at);
    const dayEntry = dayMap.get(day) ?? { day, calls: 0, totalTokens: 0 };
    dayEntry.calls += 1;
    dayEntry.totalTokens += record.totalTokens;
    dayMap.set(day, dayEntry);
  }

  return {
    ...totals,
    byModel: [...modelMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    byScene: [...sceneMap.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    byDay: [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day)),
  };
};

/** 格式化成「1.2k」这样的短文本。 */
export const formatTokenCount = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) < 1000) return String(Math.round(value));
  if (Math.abs(value) < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
};

export const formatCost = (value: number | null): string => {
  if (value === null) return "—";
  if (value === 0) return "$0";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
};
