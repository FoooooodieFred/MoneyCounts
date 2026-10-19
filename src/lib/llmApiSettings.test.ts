import { describe, expect, it } from "vitest";
import {
  activeLlmProfile,
  addLlmProvider,
  applyLlmProviderPreset,
  createLlmProfile,
  DEFAULT_LLM_API_SETTINGS,
  estimateLlmCost,
  llmApiForBackup,
  LLM_PROVIDER_PRESETS,
  normalizeLlmApiSettings,
  normalizeLlmApiStore,
  removeLlmProfile,
  removeLlmProvider,
  updateLlmProfile,
} from "./llmApiSettings";

describe("llmApiStore migration", () => {
  it("turns the old flat settings into a single profile", () => {
    const store = normalizeLlmApiStore({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-legacy",
      model: "gpt-4.1-mini",
      jsonMode: false,
      customSystemPrompt: "只记餐饮",
      verified: true,
    });
    expect(store.version).toBe(2);
    expect(store.profiles).toHaveLength(1);
    const profile = store.profiles[0];
    expect(profile.apiKey).toBe("sk-legacy");
    expect(profile.model).toBe("gpt-4.1-mini");
    expect(profile.jsonMode).toBe(false);
    expect(profile.customSystemPrompt).toBe("只记餐饮");
    expect(profile.verified).toBe(true);
    expect(store.activeProfileId).toBe(profile.profileId);
    expect(activeLlmProfile(store)).toBe(profile);
  });

  it("keeps the default profile when nothing is stored", () => {
    const store = normalizeLlmApiStore(null);
    expect(store.profiles).toHaveLength(1);
    expect(store.profiles[0].apiKey).toBe("");
    expect(store.profiles[0].includeInBackup).toBe(false);
    expect(store.providers.length).toBe(LLM_PROVIDER_PRESETS.length);
  });

  it("drops an activeProfileId that no longer exists", () => {
    const store = normalizeLlmApiStore({
      profiles: [{ profileId: "a", model: "m" }],
      activeProfileId: "missing",
    });
    expect(store.activeProfileId).toBe("a");
  });

  it("keeps user-defined providers alongside the built-ins", () => {
    const store = normalizeLlmApiStore({
      providers: [
        {
          id: "gateway",
          label: "公司网关",
          baseUrl: "https://gw.example.com/v1",
          apiStyle: "chat-completions",
          builtIn: false,
        },
      ],
      profiles: [{ profileId: "a", provider: "gateway", model: "m" }],
    });
    expect(store.providers.some((item) => item.id === "gateway")).toBe(true);
    expect(store.providers.some((item) => item.id === "openai")).toBe(true);
    expect(store.profiles[0].provider).toBe("gateway");
  });
});

describe("llm profile fields", () => {
  it("clamps temperature, top_p and max_tokens into sane ranges", () => {
    const next = normalizeLlmApiSettings({
      temperature: 9,
      topP: 4,
      maxTokens: 12.7,
    });
    expect(next.temperature).toBe(2);
    expect(next.topP).toBe(1);
    expect(next.maxTokens).toBe(12);
  });

  it("treats empty optional numbers as 'do not send'", () => {
    const next = normalizeLlmApiSettings({ maxTokens: null, topP: null, contextWindow: 0 });
    expect(next.maxTokens).toBeNull();
    expect(next.topP).toBeNull();
    expect(next.contextWindow).toBeNull();
  });

  it("keeps extra headers and extra body", () => {
    const next = normalizeLlmApiSettings({
      extraHeaders: { "X-Team": "core", "": "dropped" },
      extraBody: { reasoning_effort: "high" },
    });
    expect(next.extraHeaders).toEqual({ "X-Team": "core" });
    expect(next.extraBody).toEqual({ reasoning_effort: "high" });
  });

  it("defaults the prompt mode to append so the 35 classes survive", () => {
    expect(normalizeLlmApiSettings({}).promptMode).toBe("append");
    expect(normalizeLlmApiSettings({ promptMode: "replace" }).promptMode).toBe("replace");
  });

  it("follows the provider's api style when the profile does not set one", () => {
    const next = normalizeLlmApiSettings({ provider: "anthropic" });
    expect(next.apiStyle).toBe("anthropic");
    expect(next.baseUrl).toBe("https://api.anthropic.com/v1");
  });
});

describe("llm provider presets", () => {
  it("switches address and style and clears the model", () => {
    const next = applyLlmProviderPreset(
      { ...DEFAULT_LLM_API_SETTINGS, model: "old-model" },
      "anthropic",
    );
    expect(next.provider).toBe("anthropic");
    expect(next.apiStyle).toBe("anthropic");
    expect(next.model).toBe("");
    expect(next.verified).toBe(false);
  });

  it("adds and removes a user-defined provider but keeps built-ins", () => {
    let store = normalizeLlmApiStore(null);
    store = addLlmProvider(store, {
      label: "公司网关",
      baseUrl: "https://gw.example.com/v1",
      modelPlaceholder: "gw-model",
      apiStyle: "chat-completions",
      models: [],
      extraHeaders: {},
      extraBody: {},
    });
    const added = store.providers.at(-1);
    expect(added?.label).toBe("公司网关");
    expect(added?.builtIn).toBe(false);

    const removed = removeLlmProvider(store, added!.id);
    expect(removed.providers.some((item) => item.id === added!.id)).toBe(false);

    // 内置供应商删不掉
    const stillThere = removeLlmProvider(store, "openai");
    expect(stillThere.providers.some((item) => item.id === "openai")).toBe(true);
  });
});

describe("llm profile management", () => {
  it("creates a copy with a fresh id and no model", () => {
    const source = normalizeLlmApiSettings({
      profileId: "a",
      profileName: "主力",
      model: "gpt-4.1-mini",
      apiKey: "sk-1",
    });
    const copy = createLlmProfile(source);
    expect(copy.profileId).not.toBe("a");
    expect(copy.model).toBe("");
    expect(copy.verified).toBe(false);
    expect(copy.apiKey).toBe("sk-1");
  });

  it("updates one profile and leaves the others alone", () => {
    let store = normalizeLlmApiStore({
      profiles: [
        { profileId: "a", model: "m1" },
        { profileId: "b", model: "m2" },
      ],
      activeProfileId: "a",
    });
    store = updateLlmProfile(store, "a", { model: "m1-new" });
    expect(store.profiles[0].model).toBe("m1-new");
    expect(store.profiles[1].model).toBe("m2");
  });

  it("removes a profile and re-points the active one", () => {
    let store = normalizeLlmApiStore({
      profiles: [
        { profileId: "a", model: "m1" },
        { profileId: "b", model: "m2" },
      ],
      activeProfileId: "a",
    });
    store = removeLlmProfile(store, "a");
    expect(store.profiles).toHaveLength(1);
    expect(store.activeProfileId).toBe("b");
  });

  it("never removes the last profile", () => {
    const store = normalizeLlmApiStore({ profiles: [{ profileId: "a" }] });
    expect(removeLlmProfile(store, "a").profiles).toHaveLength(1);
  });
});

describe("backup round trip", () => {
  it("restores every profile and custom provider from a backup payload", () => {
    let store = normalizeLlmApiStore({
      profiles: [
        { profileId: "a", profileName: "主力", model: "gpt-4.1-mini", includeInBackup: true },
        { profileId: "b", profileName: "备用", model: "deepseek-chat", includeInBackup: true },
      ],
      activeProfileId: "a",
    });
    store = addLlmProvider(store, {
      label: "公司网关",
      baseUrl: "https://gw.example.com/v1",
      modelPlaceholder: "gw-model",
      apiStyle: "chat-completions",
      models: [],
      extraHeaders: {},
      extraBody: {},
    });

    const backup = llmApiForBackup(store);
    expect(backup).toBeDefined();
    const restored = normalizeLlmApiStore(JSON.parse(JSON.stringify(backup)));
    expect(restored.profiles).toHaveLength(2);
    expect(restored.profiles[0].model).toBe("gpt-4.1-mini");
    expect(restored.profiles[1].profileName).toBe("备用");
    expect(restored.activeProfileId).toBe("a");
    expect(restored.providers.some((item) => item.label === "公司网关")).toBe(true);
  });

  it("still reads a backup that was written by the old flat format", () => {
    const restored = normalizeLlmApiStore({
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-old",
      model: "gpt-4.1-mini",
    });
    expect(restored.profiles).toHaveLength(1);
    expect(restored.profiles[0].apiKey).toBe("sk-old");
  });

  it("leaves the whole store out of the backup when the profile did not opt in", () => {
    const store = normalizeLlmApiStore({
      profiles: [{ profileId: "a", includeInBackup: false }],
    });
    expect(llmApiForBackup(store)).toBeUndefined();
  });
});

describe("llm cost estimation", () => {
  it("returns null when no price is configured", () => {
    expect(estimateLlmCost(DEFAULT_LLM_API_SETTINGS, 1000, 1000)).toBeNull();
  });

  it("adds input and output price per million tokens", () => {
    const settings = normalizeLlmApiSettings({
      inputPricePerMillion: 3,
      outputPricePerMillion: 15,
    });
    // 1000 输入 = 0.003，1000 输出 = 0.015
    expect(estimateLlmCost(settings, 1000, 1000)).toBeCloseTo(0.018, 6);
  });

  it("treats a missing side as free", () => {
    const settings = normalizeLlmApiSettings({ inputPricePerMillion: 10 });
    expect(estimateLlmCost(settings, 1_000_000, 0)).toBeCloseTo(10, 6);
  });
});
