/**
 * LLM 接口配置。单独 LocalStorage key；默认不进 JSON 备份，可在看台或设置里选择写入。
 * 模型名只作输入示意（placeholder），连通成功后才锁死 URL / 模型 / Key。
 */
import { kvGet, kvSet } from "./kv";
import { LLM_API_SETTINGS_KEY } from "./storageKeys";

export { LLM_API_SETTINGS_KEY };

export const LLM_PROVIDER_IDS = [
  "openai",
  "deepseek",
  "moonshot",
  "groq",
  "openrouter",
  "minimax",
  "custom",
] as const;

export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

export type LlmProviderPreset = {
  id: LlmProviderId;
  label: string;
  baseUrl: string;
  /** 仅作输入框 placeholder，不写入实际模型名。 */
  modelPlaceholder: string;
};

export const LLM_PROVIDER_PRESETS: readonly LlmProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelPlaceholder: "gpt-4.1-mini",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    modelPlaceholder: "deepseek-chat",
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    baseUrl: "https://api.moonshot.cn/v1",
    modelPlaceholder: "moonshot-v1-8k",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelPlaceholder: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelPlaceholder: "openai/gpt-4.1-mini",
  },
  {
    id: "minimax",
    label: "MiniMax",
    baseUrl: "https://api.minimaxi.com/v1",
    modelPlaceholder: "MiniMax-M2.5",
  },
  {
    id: "custom",
    label: "自定义",
    baseUrl: "",
    modelPlaceholder: "your-model-id",
  },
] as const;

export type LlmApiSettings = {
  provider: LlmProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  jsonMode: boolean;
  customSystemPrompt: string;
  verified: boolean;
  /** 开启后导出 JSON 备份会带上接口与密钥，换设备可直接恢复。 */
  includeInBackup: boolean;
};

export const DEFAULT_LLM_API_SETTINGS: LlmApiSettings = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com/v1",
  apiKey: "",
  model: "",
  jsonMode: true,
  customSystemPrompt: "",
  verified: false,
  includeInBackup: false,
};

const isProviderId = (value: unknown): value is LlmProviderId =>
  typeof value === "string" && LLM_PROVIDER_IDS.includes(value as LlmProviderId);

export const getLlmProviderPreset = (provider: LlmProviderId) =>
  LLM_PROVIDER_PRESETS.find((item) => item.id === provider) ?? LLM_PROVIDER_PRESETS[0];

export const normalizeLlmApiSettings = (value: unknown): LlmApiSettings => {
  const source = value && typeof value === "object" ? (value as Partial<LlmApiSettings>) : {};
  const provider = isProviderId(source.provider)
    ? source.provider
    : DEFAULT_LLM_API_SETTINGS.provider;
  const preset = getLlmProviderPreset(provider);
  const baseUrl =
    typeof source.baseUrl === "string" && source.baseUrl.trim()
      ? source.baseUrl.trim()
      : preset.baseUrl;
  return {
    provider,
    baseUrl,
    apiKey: typeof source.apiKey === "string" ? source.apiKey.trim() : "",
    model: typeof source.model === "string" ? source.model.trim() : "",
    jsonMode: source.jsonMode !== false,
    customSystemPrompt:
      typeof source.customSystemPrompt === "string" ? source.customSystemPrompt : "",
    verified: source.verified === true,
    includeInBackup: source.includeInBackup === true,
  };
};

export const isLlmApiConfigured = (settings: LlmApiSettings) =>
  Boolean(settings.apiKey && settings.baseUrl && settings.model);

export const isLlmApiVerified = (settings: LlmApiSettings) =>
  isLlmApiConfigured(settings) && settings.verified;

export const readLlmApiSettings = (): LlmApiSettings => {
  try {
    return normalizeLlmApiSettings(JSON.parse(kvGet(LLM_API_SETTINGS_KEY) ?? "null"));
  } catch {
    return DEFAULT_LLM_API_SETTINGS;
  }
};

export const saveLlmApiSettings = (settings: LlmApiSettings) => {
  kvSet(LLM_API_SETTINGS_KEY, JSON.stringify(normalizeLlmApiSettings(settings)));
};

/** 仅在用户勾选「写入备份」时返回可序列化的接口配置。 */
export const llmApiForBackup = (settings: LlmApiSettings): LlmApiSettings | undefined =>
  settings.includeInBackup ? normalizeLlmApiSettings(settings) : undefined;

export const applyLlmProviderPreset = (
  current: LlmApiSettings,
  provider: LlmProviderId,
): LlmApiSettings => {
  const preset = LLM_PROVIDER_PRESETS.find((item) => item.id === provider);
  if (!preset) return current;
  return normalizeLlmApiSettings({
    ...current,
    provider,
    baseUrl: preset.baseUrl,
    model: "",
    verified: false,
  });
};
