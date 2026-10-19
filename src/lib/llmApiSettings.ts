/**
 * LLM 接口配置。单独 LocalStorage key；默认不进 JSON 备份，可在看台或设置里选择写入。
 *
 * 一份配置里有两层：
 * - 供应商预设（provider）：「地址 + 接口风格 + 默认参数」的模板。内置若干家，也允许用户自己加，
 *   这样接入后续新模型不用改代码。
 * - 连接档案（profile）：真正会用的连接，含地址、模型、密钥、生成参数与计价。可以建多套并随时切换。
 *
 * 旧版只有一个扁平配置对象；读的时候会自动迁移成「单档案」，用户不用重新填密钥。
 */
import { kvGet, kvSet } from "./kv";
import { LLM_API_SETTINGS_KEY } from "./storageKeys";
import type { LlmPromptMode } from "./llmLedgerPrompt";

export { LLM_API_SETTINGS_KEY };

/** 接口风格：决定请求体怎么拼、响应怎么读。 */
export type LlmApiStyle = "chat-completions" | "responses" | "anthropic";

export const LLM_API_STYLES: readonly { id: LlmApiStyle; label: string; hint: string }[] = [
  {
    id: "chat-completions",
    label: "Chat Completions",
    hint: "OpenAI 兼容接口，主流供应商与本地推理服务都用这一种。",
  },
  {
    id: "responses",
    label: "Responses",
    hint: "OpenAI 新接口（/responses），多模态与推理模型用。",
  },
  {
    id: "anthropic",
    label: "Anthropic Messages",
    hint: "Claude 原生接口，密钥放在 x-api-key 头。",
  },
];

export const isLlmApiStyle = (value: unknown): value is LlmApiStyle =>
  typeof value === "string" && LLM_API_STYLES.some((style) => style.id === value);

export type LlmProviderPreset = {
  id: string;
  label: string;
  baseUrl: string;
  /** 仅作输入框 placeholder，不写入实际模型名。 */
  modelPlaceholder: string;
  apiStyle: LlmApiStyle;
  /** 常见模型名，供「拉取模型列表」失败时手动挑。 */
  models: readonly string[];
  /** 该供应商要求的额外请求头。 */
  extraHeaders: Record<string, string>;
  /** 该供应商需要的额外请求体字段。 */
  extraBody: Record<string, unknown>;
  /** 内置预设不可删除。 */
  builtIn: boolean;
};

export const LLM_PROVIDER_IDS = [
  "openai",
  "deepseek",
  "moonshot",
  "groq",
  "openrouter",
  "minimax",
  "anthropic",
  "ollama",
  "custom",
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4.1-mini",
    apiStyle: "chat-completions",
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "o4-mini"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelPlaceholder: "deepseek-chat",
    apiStyle: "chat-completions",
    models: ["deepseek-chat", "deepseek-reasoner"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    modelPlaceholder: "moonshot-v1-8k",
    apiStyle: "chat-completions",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2-0905-preview"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelPlaceholder: "llama-3.3-70b-versatile",
    apiStyle: "chat-completions",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelPlaceholder: "openai/gpt-4.1-mini",
    apiStyle: "chat-completions",
    models: ["openai/gpt-4.1-mini", "anthropic/claude-sonnet-4"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    modelPlaceholder: "MiniMax-M2.5",
    apiStyle: "chat-completions",
    models: ["MiniMax-M2.5", "MiniMax-M2"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    modelPlaceholder: "claude-sonnet-4-5",
    apiStyle: "anthropic",
    models: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-1"],
    extraHeaders: { "anthropic-version": "2023-06-01" },
    extraBody: {},
    builtIn: true,
  },
  {
    id: "ollama",
    label: "Ollama / 本地",
    baseUrl: "http://localhost:11434/v1",
    modelPlaceholder: "qwen3:8b",
    apiStyle: "chat-completions",
    models: ["qwen3:8b", "llama3.2:3b"],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
  {
    id: "custom",
    label: "自定义",
    baseUrl: "",
    modelPlaceholder: "your-model-id",
    apiStyle: "chat-completions",
    models: [],
    extraHeaders: {},
    extraBody: {},
    builtIn: true,
  },
] as const;

/** 一条连接档案。 */
export type LlmApiSettings = {
  /** 档案 id；旧数据迁移过来时会有值。 */
  profileId: string;
  /** 档案显示名。 */
  profileName: string;
  /** 指向供应商预设 id，也可能是用户自建供应商的 id。 */
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  apiStyle: LlmApiStyle;
  jsonMode: boolean;
  temperature: number;
  /** 单次回复上限；null 表示不限制（由供应商决定）。 */
  maxTokens: number | null;
  /** 核采样；null 表示不发送。 */
  topP: number | null;
  /** 额外请求头，例如某些网关要带的团队标识。 */
  extraHeaders: Record<string, string>;
  /** 额外请求体字段，供应商特有的参数放这里。 */
  extraBody: Record<string, unknown>;
  /** 该模型是否支持 function calling。 */
  supportsTools: boolean;
  /** 上下文长度（token），用于 Token 看台估算占用率。 */
  contextWindow: number | null;
  /** 每百万输入 token 价格，用于成本估算。 */
  inputPricePerMillion: number | null;
  /** 每百万输出 token 价格，用于成本估算。 */
  outputPricePerMillion: number | null;
  customSystemPrompt: string;
  /** 自定义提示词是「追加」还是「替换」默认提示词。 */
  promptMode: LlmPromptMode;
  verified: boolean;
  /** 开启后导出 JSON 备份会带上接口与密钥，换设备可直接恢复。 */
  includeInBackup: boolean;
};

/** 完整配置：供应商预设 + 全部档案。 */
export type LlmApiStore = {
  version: 2;
  providers: LlmProviderPreset[];
  profiles: LlmApiSettings[];
  activeProfileId: string;
};

const DEFAULT_TEMPERATURE = 0;

export const createLlmProfileId = () => {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `p_${random.slice(0, 8)}`;
  return `p_${Math.random().toString(36).slice(2, 10)}`;
};

export const createLlmProviderId = () => {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `c_${random.slice(0, 8)}`;
  return `c_${Math.random().toString(36).slice(2, 10)}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asTrimmedString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value.trim() : fallback;

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const asNumberOrNull = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const asStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainObject(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    const name = key.trim();
    if (!name) continue;
    if (typeof item === "string") out[name] = item;
    else if (typeof item === "number" || typeof item === "boolean") out[name] = String(item);
  }
  return out;
};

const asUnknownRecord = (value: unknown): Record<string, unknown> => {
  if (!isPlainObject(value)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const name = key.trim();
    if (!name) continue;
    out[name] = item;
  }
  return out;
};

export const getLlmProviderPreset = (
  providerId: string,
  providers: readonly LlmProviderPreset[] = LLM_PROVIDER_PRESETS,
) =>
  providers.find((item) => item.id === providerId) ??
  providers.find((item) => item.id === "custom") ??
  LLM_PROVIDER_PRESETS[0];

export const DEFAULT_LLM_API_SETTINGS: LlmApiSettings = {
  profileId: "default",
  profileName: "默认接口",
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "",
  apiStyle: "chat-completions",
  jsonMode: true,
  temperature: DEFAULT_TEMPERATURE,
  maxTokens: null,
  topP: null,
  extraHeaders: {},
  extraBody: {},
  supportsTools: true,
  contextWindow: null,
  inputPricePerMillion: null,
  outputPricePerMillion: null,
  customSystemPrompt: "",
  promptMode: "append",
  verified: false,
  includeInBackup: false,
};

export const normalizeLlmProviderPreset = (
  value: unknown,
  fallbackId?: string,
): LlmProviderPreset => {
  const source = isPlainObject(value) ? value : {};
  const id = asTrimmedString(source.id, fallbackId ?? "custom") || "custom";
  const builtIn = asBoolean(source.builtIn, false);
  const base = LLM_PROVIDER_PRESETS.find((item) => item.id === id);
  return {
    id,
    label: asTrimmedString(source.label, base?.label ?? id) || id,
    baseUrl: asTrimmedString(source.baseUrl, base?.baseUrl ?? ""),
    modelPlaceholder: asTrimmedString(
      source.modelPlaceholder,
      base?.modelPlaceholder ?? "your-model-id",
    ),
    apiStyle: isLlmApiStyle(source.apiStyle) ? source.apiStyle : (base?.apiStyle ?? "chat-completions"),
    models: Array.isArray(source.models)
      ? source.models.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : [...(base?.models ?? [])],
    extraHeaders: { ...(base?.extraHeaders ?? {}), ...asStringRecord(source.extraHeaders) },
    extraBody: { ...(base?.extraBody ?? {}), ...asUnknownRecord(source.extraBody) },
    builtIn,
  };
};

/**
 * 归一化一条档案。兼容旧版扁平对象：旧的 `provider` / `baseUrl` / `apiKey` 等字段
 * 直接落在这层，所以旧配置读出来就是「一条档案」。
 */
export const normalizeLlmApiSettings = (value: unknown): LlmApiSettings => {
  const source = isPlainObject(value) ? value : {};
  const provider = asTrimmedString(source.provider, DEFAULT_LLM_API_SETTINGS.provider);
  const preset = getLlmProviderPreset(provider);
  const baseUrl = asTrimmedString(source.baseUrl) || preset.baseUrl;
  return {
    profileId: asTrimmedString(source.profileId, "default") || "default",
    profileName: asTrimmedString(source.profileName, "默认接口") || "默认接口",
    provider,
    baseUrl,
    apiKey: asTrimmedString(source.apiKey),
    model: asTrimmedString(source.model),
    apiStyle: isLlmApiStyle(source.apiStyle) ? source.apiStyle : preset.apiStyle,
    jsonMode: asBoolean(source.jsonMode, true),
    temperature: (() => {
      const value = asNumberOrNull(source.temperature);
      if (value === null) return DEFAULT_TEMPERATURE;
      return Math.min(2, Math.max(0, value));
    })(),
    maxTokens: (() => {
      const value = asNumberOrNull(source.maxTokens);
      if (value === null || value <= 0) return null;
      return Math.floor(value);
    })(),
    topP: (() => {
      const value = asNumberOrNull(source.topP);
      if (value === null) return null;
      return Math.min(1, Math.max(0, value));
    })(),
    extraHeaders: asStringRecord(source.extraHeaders),
    extraBody: asUnknownRecord(source.extraBody),
    supportsTools: asBoolean(source.supportsTools, true),
    contextWindow: (() => {
      const value = asNumberOrNull(source.contextWindow);
      return value && value > 0 ? Math.floor(value) : null;
    })(),
    inputPricePerMillion: asNumberOrNull(source.inputPricePerMillion),
    outputPricePerMillion: asNumberOrNull(source.outputPricePerMillion),
    customSystemPrompt: asString(source.customSystemPrompt),
    promptMode: source.promptMode === "replace" ? "replace" : "append",
    verified: asBoolean(source.verified, false),
    includeInBackup: asBoolean(source.includeInBackup, false),
  };
};

const looksLikeStore = (value: unknown): value is { profiles: unknown[]; providers?: unknown } =>
  isPlainObject(value) && Array.isArray(value.profiles);

export const normalizeLlmApiStore = (value: unknown): LlmApiStore => {
  // 旧版：单份扁平配置，迁移成一条档案。
  if (!looksLikeStore(value)) {
    const profile = normalizeLlmApiSettings(value);
    return {
      version: 2,
      providers: [...LLM_PROVIDER_PRESETS],
      profiles: [profile],
      activeProfileId: profile.profileId,
    };
  }

  const rawProviders = Array.isArray(value.providers) ? value.providers : [];
  const customProviders = rawProviders
    .filter((item) => isPlainObject(item) && !asBoolean(item.builtIn, false))
    .map((item) => normalizeLlmProviderPreset(item));
  const providers = [
    ...LLM_PROVIDER_PRESETS,
    ...customProviders.filter(
      (item) => !LLM_PROVIDER_PRESETS.some((preset) => preset.id === item.id),
    ),
  ];

  const rawProfiles = Array.isArray(value.profiles) ? value.profiles : [];
  const profiles = rawProfiles.map((item) => normalizeLlmApiSettings(item));
  if (!profiles.length) {
    profiles.push({ ...DEFAULT_LLM_API_SETTINGS });
  }

  const requestedActive = asTrimmedString(
    (value as { activeProfileId?: unknown }).activeProfileId,
  );
  const activeProfileId = profiles.some((item) => item.profileId === requestedActive)
    ? requestedActive
    : profiles[0].profileId;

  return { version: 2, providers, profiles, activeProfileId };
};

export const isLlmApiConfigured = (settings: LlmApiSettings) =>
  Boolean(settings.apiKey && settings.baseUrl && settings.model);

export const isLlmApiVerified = (settings: LlmApiSettings) =>
  isLlmApiConfigured(settings) && settings.verified;

/** 取出当前生效的档案。 */
export const activeLlmProfile = (store: LlmApiStore): LlmApiSettings =>
  store.profiles.find((item) => item.profileId === store.activeProfileId) ?? store.profiles[0];

export const readLlmApiStore = (): LlmApiStore => {
  try {
    return normalizeLlmApiStore(JSON.parse(kvGet(LLM_API_SETTINGS_KEY) ?? "null"));
  } catch {
    return normalizeLlmApiStore(null);
  }
};

export const saveLlmApiStore = (store: LlmApiStore) => {
  kvSet(LLM_API_SETTINGS_KEY, JSON.stringify(normalizeLlmApiStore(store)));
};

/** 当前生效的档案（旧的扁平读取接口保持可用）。 */
export const readLlmApiSettings = (): LlmApiSettings => activeLlmProfile(readLlmApiStore());

/** 保存一条档案：按 profileId 落回 store；profileId 变了就切换过去。 */
export const saveLlmApiSettings = (settings: LlmApiSettings) => {
  const store = readLlmApiStore();
  const profile = normalizeLlmApiSettings(settings);
  const index = store.profiles.findIndex((item) => item.profileId === profile.profileId);
  if (index >= 0) store.profiles[index] = profile;
  else store.profiles.push(profile);
  store.activeProfileId = profile.profileId;
  saveLlmApiStore(store);
};

/** 仅在用户勾选「写入备份」时返回可序列化的接口配置。 */
export const llmApiForBackup = (store: LlmApiStore): LlmApiStore | undefined => {
  const active = activeLlmProfile(store);
  if (!active.includeInBackup) return undefined;
  return normalizeLlmApiStore(store);
};

/** 换供应商预设：覆盖地址与风格，模型名清空（需要重新填）。 */
export const applyLlmProviderPreset = (
  current: LlmApiSettings,
  providerId: string,
  providers: readonly LlmProviderPreset[] = LLM_PROVIDER_PRESETS,
): LlmApiSettings => {
  const preset = providers.find((item) => item.id === providerId);
  if (!preset) return current;
  return normalizeLlmApiSettings({
    ...current,
    provider: preset.id,
    baseUrl: preset.baseUrl,
    model: "",
    apiStyle: preset.apiStyle,
    extraHeaders: { ...preset.extraHeaders, ...current.extraHeaders },
    verified: false,
  });
};

/** 新建一条档案，继承当前档案的通用设置。 */
export const createLlmProfile = (source: LlmApiSettings): LlmApiSettings => ({
  ...normalizeLlmApiSettings(source),
  profileId: createLlmProfileId(),
  profileName: `${source.profileName} 副本`,
  model: "",
  verified: false,
});

export const updateLlmProfile = (
  store: LlmApiStore,
  profileId: string,
  patch: Partial<LlmApiSettings>,
): LlmApiStore => {
  const index = store.profiles.findIndex((item) => item.profileId === profileId);
  if (index < 0) return store;
  const next = normalizeLlmApiSettings({ ...store.profiles[index], ...patch });
  const profiles = [...store.profiles];
  profiles[index] = next;
  return { ...store, profiles };
};

export const removeLlmProfile = (store: LlmApiStore, profileId: string): LlmApiStore => {
  if (store.profiles.length <= 1) return store;
  const profiles = store.profiles.filter((item) => item.profileId !== profileId);
  if (!profiles.length) return store;
  const activeProfileId =
    store.activeProfileId === profileId ? profiles[0].profileId : store.activeProfileId;
  return { ...store, profiles, activeProfileId };
};

export const addLlmProvider = (
  store: LlmApiStore,
  preset: Omit<LlmProviderPreset, "id" | "builtIn"> & { id?: string },
): LlmApiStore => {
  const id = preset.id?.trim() || createLlmProviderId();
  const normalized = normalizeLlmProviderPreset({ ...preset, id, builtIn: false });
  const providers = [
    ...store.providers.filter((item) => item.id !== id),
    normalized,
  ];
  return { ...store, providers };
};

export const removeLlmProvider = (store: LlmApiStore, providerId: string): LlmApiStore => {
  const target = store.providers.find((item) => item.id === providerId);
  if (!target || target.builtIn) return store;
  return {
    ...store,
    providers: store.providers.filter((item) => item.id !== providerId),
  };
};

/** 估算一次调用的费用；没填价格就返回 null。 */
export const estimateLlmCost = (
  settings: LlmApiSettings,
  promptTokens: number,
  completionTokens: number,
): number | null => {
  const inputPrice = settings.inputPricePerMillion;
  const outputPrice = settings.outputPricePerMillion;
  if (inputPrice === null && outputPrice === null) return null;
  const input = ((inputPrice ?? 0) * Math.max(0, promptTokens)) / 1_000_000;
  const output = ((outputPrice ?? 0) * Math.max(0, completionTokens)) / 1_000_000;
  return input + output;
};
