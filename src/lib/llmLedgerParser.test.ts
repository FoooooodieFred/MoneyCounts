import { describe, expect, it } from "vitest";
import {
  applyLlmProviderPreset,
  DEFAULT_LLM_API_SETTINGS,
  isLlmApiConfigured,
  isLlmApiVerified,
  llmApiForBackup,
  LLM_PROVIDER_PRESETS,
  normalizeLlmApiSettings,
} from "./llmApiSettings";
import { handleLlmChatRequest, isAllowedLlmBaseUrl, normalizeChatCompletionsUrl } from "./llmProxy";
import { buildDefaultLedgerSystemPrompt, buildLedgerMessages } from "./llmLedgerPrompt";
import {
  applyCategoryAmountSign,
  extractJsonObject,
  parseLlmLedgerPayload,
  resolveLlmCategory,
} from "./llmLedgerParser";
import { LEDGER_CATEGORIES } from "./nlLedgerCategories";
import { parseQuickTemplatePayload } from "./llmQuickTemplates";

const context = {
  selectedDate: "2026-08-31",
  defaultCurrency: "HKD",
  categories: LEDGER_CATEGORIES,
  currencies: ["HKD", "CNY", "JPY", "USD"],
};

describe("llmApiSettings", () => {
  it("treats missing key as not configured", () => {
    expect(isLlmApiConfigured(DEFAULT_LLM_API_SETTINGS)).toBe(false);
    expect(isLlmApiVerified(DEFAULT_LLM_API_SETTINGS)).toBe(false);
    expect(
      isLlmApiConfigured({
        ...DEFAULT_LLM_API_SETTINGS,
        apiKey: "sk-test",
        model: "deepseek-chat",
      }),
    ).toBe(true);
    expect(
      isLlmApiVerified({
        ...DEFAULT_LLM_API_SETTINGS,
        apiKey: "sk-test",
        model: "deepseek-chat",
        verified: true,
      }),
    ).toBe(true);
  });

  it("uses MiniMax OpenAI-compatible /v1 and placeholder-only models", () => {
    expect(LLM_PROVIDER_PRESETS.map((item) => item.id).join(",")).not.toContain("silicon");
    const minimax = LLM_PROVIDER_PRESETS.find((item) => item.id === "minimax");
    expect(minimax?.baseUrl).toBe("https://api.minimaxi.com/v1");
    expect(minimax?.modelPlaceholder).toBe("MiniMax-M2.5");
    expect(DEFAULT_LLM_API_SETTINGS.model).toBe("");
    expect(DEFAULT_LLM_API_SETTINGS.includeInBackup).toBe(false);
  });

  it("omits API settings from backup unless the user opts in", () => {
    expect(llmApiForBackup(DEFAULT_LLM_API_SETTINGS)).toBeUndefined();
    const opted = llmApiForBackup({
      ...DEFAULT_LLM_API_SETTINGS,
      apiKey: "sk-test",
      model: "MiniMax-M2.5",
      includeInBackup: true,
    });
    expect(opted?.apiKey).toBe("sk-test");
    expect(opted?.includeInBackup).toBe(true);
  });

  it("fills preset url and leaves model empty as placeholder", () => {
    const next = applyLlmProviderPreset(DEFAULT_LLM_API_SETTINGS, "openai");
    expect(next.provider).toBe("openai");
    expect(next.baseUrl).toBe("https://api.openai.com/v1");
    expect(next.model).toBe("");
    expect(next.verified).toBe(false);
  });

  it("keeps custom key and trims fields", () => {
    const next = normalizeLlmApiSettings({
      provider: "custom",
      baseUrl: " https://example.com/v1 ",
      apiKey: " sk ",
      model: " llama ",
      jsonMode: false,
    });
    expect(next.apiKey).toBe("sk");
    expect(next.baseUrl).toBe("https://example.com/v1");
    expect(next.jsonMode).toBe(false);
  });
});

describe("llmProxy url guards", () => {
  it("appends chat/completions once", () => {
    expect(normalizeChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(normalizeChatCompletionsUrl("https://api.openai.com/v1/chat/completions/")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("keeps MiniMax native endpoint path", () => {
    expect(normalizeChatCompletionsUrl("https://api.minimaxi.com/v1/text/chatcompletion_v2")).toBe(
      "https://api.minimaxi.com/v1/text/chatcompletion_v2",
    );
  });

  it("fills MiniMax OpenAI-compatible /v1 url", () => {
    const next = applyLlmProviderPreset(DEFAULT_LLM_API_SETTINGS, "minimax");
    expect(next.baseUrl).toBe("https://api.minimaxi.com/v1");
    expect(next.model).toBe("");
  });

  it("allows https and local http only", () => {
    expect(isAllowedLlmBaseUrl("https://api.deepseek.com/v1")).toBe(true);
    expect(isAllowedLlmBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isAllowedLlmBaseUrl("http://example.com/v1")).toBe(false);
    expect(isAllowedLlmBaseUrl("https://user:pass@evil.test")).toBe(false);
  });
});

describe("ledger prompts", () => {
  it("embeds all 35 live category names", () => {
    const prompt = buildDefaultLedgerSystemPrompt();
    for (const name of LEDGER_CATEGORIES) {
      expect(prompt).toContain(name);
    }
    expect(prompt).toContain("date_spec");
    expect(prompt).toContain("week:0");
  });

  it("puts the utterance in the user message", () => {
    const messages = buildLedgerMessages("午餐 45", context);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].content).toContain("午餐 45");
    expect(messages[1].content).toContain("2026-08-31");
  });
});

describe("parseLlmLedgerPayload", () => {
  it("extracts json from fenced model output", () => {
    expect(extractJsonObject('```json\n{"entries":[]}\n```')).toEqual({ entries: [] });
    expect(extractJsonObject('prefix [{"date":"2026-01-01"}] suffix')).toEqual([
      { date: "2026-01-01" },
    ]);
    expect(extractJsonObject('[]{"rows":[{"date":"2026-01-01","amount":"1"}]}')).toEqual({
      rows: [{ date: "2026-01-01", amount: "1" }],
    });
    expect(extractJsonObject('{}{"rows":[{"date":"2026-01-02"}]}')).toEqual({
      rows: [{ date: "2026-01-02" }],
    });
  });

  it("maps category ids and signs negative expenses", () => {
    expect(resolveLlmCategory("food_dining")).toBe("餐饮美食");
    expect(applyCategoryAmountSign("他人还款", "100")).toBe("-100");
    expect(applyCategoryAmountSign("工资收入", "-5000")).toBe("-5000");
    expect(applyCategoryAmountSign("餐饮美食", "45.5")).toBe("45.5");
  });

  it("expands week spec into seven same-amount rows", () => {
    const result = parseLlmLedgerPayload(
      {
        entries: [
          {
            date_spec: "week:0",
            category: "交通出行",
            amount: "10.8",
            currency: "HKD",
            note: "地铁来回",
          },
        ],
      },
      context,
    );
    expect(result.source).toBe("llm");
    expect(result.records).toHaveLength(7);
    expect(result.records.every((row) => row.amount === "10.8")).toBe(true);
    expect(result.records[0].date).toBe("2026-08-31");
    expect(result.records[6].date).toBe("2026-09-06");
  });

  it("copies today+tomorrow as two rows", () => {
    const result = parseLlmLedgerPayload(
      {
        entries: [
          {
            date_spec: "rel:0,1",
            category: "日用百货",
            amount: "10",
            currency: "HKD",
            note: "洗衣服",
          },
        ],
      },
      context,
    );
    expect(result.records.map((row) => row.date)).toEqual(["2026-08-31", "2026-09-01"]);
  });

  it("falls back unknown category and skips empty amount", () => {
    const result = parseLlmLedgerPayload(
      {
        entries: [
          { date_spec: "anchor", category: "未知类", amount: "12", currency: "CNY", note: "x" },
          { date_spec: "anchor", category: "餐饮美食", amount: "0", currency: "CNY", note: "y" },
        ],
        warnings: ["模型自己的提示"],
      },
      context,
    );
    expect(result.records).toHaveLength(1);
    expect(result.records[0].category).toBe("日用百货");
    expect(result.warnings.some((item) => item.includes("日用百货"))).toBe(true);
    expect(result.warnings).toContain("模型自己的提示");
  });
});

describe("parseQuickTemplatePayload", () => {
  it("keeps three unique templates that include the amount slot", () => {
    expect(
      parseQuickTemplatePayload({
        templates: ["午餐 __ 元", "地铁来回 __", "朋友还我 __", "太长了所以不应该保留的句子 __ 元"],
      }),
    ).toEqual(["午餐 __ 元", "地铁来回 __", "朋友还我 __"]);
  });

  it("drops templates without the amount slot", () => {
    expect(parseQuickTemplatePayload({ templates: ["午餐 45 元", "地铁 __"] })).toEqual([
      "地铁 __",
    ]);
  });
});

describe("handleLlmChatRequest", () => {
  it("rejects missing API key", async () => {
    const response = await handleLlmChatRequest(
      new Request("http://local/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: "https://api.deepseek.com/v1",
          model: "deepseek-chat",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("rejects non-https remote base urls", async () => {
    const response = await handleLlmChatRequest(
      new Request("http://local/api/llm/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer sk-test",
        },
        body: JSON.stringify({
          baseUrl: "http://example.com/v1",
          model: "x",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
