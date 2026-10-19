import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeLlmApiSettings } from "./llmApiSettings";
import { requestLlmChat } from "./llmChatClient";
import {
  estimateTokens,
  formatCost,
  formatTokenCount,
  LLM_USAGE_LIMIT,
  readLlmUsage,
  recordLlmUsage,
  summarizeLlmUsage,
  type LlmUsageRecord,
} from "./llmUsage";

const memory = new Map<string, string>();

const installLocalStorage = () => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
};

const settings = normalizeLlmApiSettings({
  profileId: "p1",
  profileName: "主力",
  provider: "openai",
  model: "gpt-4.1-mini",
  inputPricePerMillion: 3,
  outputPricePerMillion: 15,
});

beforeEach(() => {
  installLocalStorage();
  vi.restoreAllMocks();
});

describe("token estimation", () => {
  it("counts CJK roughly one token per character", () => {
    expect(estimateTokens("午餐")).toBe(2);
  });

  it("counts latin text at roughly four characters per token", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
  });

  it("returns zero for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("usage recording", () => {
  it("uses the upstream numbers when they are reported", () => {
    recordLlmUsage({
      settings,
      scene: "parse",
      ok: true,
      latencyMs: 120,
      promptTokens: 100,
      completionTokens: 20,
      totalTokens: 120,
    });
    const [record] = readLlmUsage();
    expect(record.promptTokens).toBe(100);
    expect(record.completionTokens).toBe(20);
    expect(record.totalTokens).toBe(120);
    expect(record.estimated).toBe(false);
    expect(record.profileName).toBe("主力");
    expect(record.model).toBe("gpt-4.1-mini");
  });

  it("falls back to estimating from the message text", () => {
    recordLlmUsage({
      settings,
      scene: "agent",
      ok: true,
      latencyMs: 90,
      messages: [{ role: "user", content: "今天午餐 45 港币" }],
      responseText: "好的",
    });
    const [record] = readLlmUsage();
    expect(record.estimated).toBe(true);
    expect(record.promptTokens).toBeGreaterThan(0);
    expect(record.completionTokens).toBeGreaterThan(0);
  });

  it("records failures with the error message", () => {
    recordLlmUsage({
      settings,
      scene: "test",
      ok: false,
      latencyMs: 30,
      error: "连接失败",
    });
    const [record] = readLlmUsage();
    expect(record.ok).toBe(false);
    expect(record.error).toBe("连接失败");
  });

  it("estimates the cost from the profile prices", () => {
    recordLlmUsage({
      settings,
      scene: "parse",
      ok: true,
      latencyMs: 10,
      promptTokens: 1_000_000,
      completionTokens: 0,
      totalTokens: 1_000_000,
    });
    expect(readLlmUsage()[0].cost).toBeCloseTo(3, 6);
  });

  it("keeps at most the configured number of records, newest first", () => {
    for (let index = 0; index < LLM_USAGE_LIMIT + 5; index += 1) {
      recordLlmUsage({
        settings,
        scene: "parse",
        ok: true,
        latencyMs: 1,
        promptTokens: index,
        completionTokens: 0,
        totalTokens: index,
      });
    }
    const records = readLlmUsage();
    expect(records).toHaveLength(LLM_USAGE_LIMIT);
    expect(records[0].promptTokens).toBe(LLM_USAGE_LIMIT + 4);
  });
});

describe("usage summary", () => {
  const makeRecord = (overrides: Partial<LlmUsageRecord>): LlmUsageRecord => ({
    at: Date.now(),
    profileId: "p1",
    profileName: "主力",
    provider: "openai",
    model: "gpt-4.1-mini",
    scene: "parse",
    ok: true,
    latencyMs: 100,
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    estimated: false,
    cost: 0.001,
    ...overrides,
  });

  it("adds up calls, tokens and cost", () => {
    const summary = summarizeLlmUsage([
      makeRecord({}),
      makeRecord({ ok: false, cost: null, totalTokens: 10, promptTokens: 10, completionTokens: 0 }),
    ]);
    expect(summary.calls).toBe(2);
    expect(summary.okCalls).toBe(1);
    expect(summary.failedCalls).toBe(1);
    expect(summary.totalTokens).toBe(160);
    expect(summary.cost).toBeCloseTo(0.001, 6);
  });

  it("groups by model, scene and day", () => {
    const now = new Date("2026-08-31T10:00:00").getTime();
    const summary = summarizeLlmUsage([
      makeRecord({ at: now, model: "m-a" }),
      makeRecord({ at: now, model: "m-b", scene: "agent" }),
      makeRecord({ at: now - 26 * 60 * 60 * 1000, model: "m-a" }),
    ]);
    expect(summary.byModel).toHaveLength(2);
    expect(summary.byScene.map((item) => item.scene).sort()).toEqual(["agent", "parse"]);
    expect(summary.byDay).toHaveLength(2);
    expect(summary.byDay[0].day).toBe("2026-08-31");
  });

  it("keeps a null cost when nothing had a price", () => {
    const summary = summarizeLlmUsage([makeRecord({ cost: null })]);
    expect(summary.cost).toBeNull();
  });
});

describe("usage formatting", () => {
  it("shortens large token counts", () => {
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1500)).toBe("1.5k");
    expect(formatTokenCount(25000)).toBe("25k");
    expect(formatTokenCount(2_500_000)).toBe("2.5M");
  });

  it("formats costs with enough precision to be useful", () => {
    expect(formatCost(null)).toBe("—");
    expect(formatCost(0)).toBe("$0");
    expect(formatCost(0.0004)).toBe("$0.0004");
    expect(formatCost(1.239)).toBe("$1.24");
  });
});

describe("chat client records usage", () => {
  it("stores a usage row after a successful call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 321, completion_tokens: 45, total_tokens: 366 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await requestLlmChat({
      settings,
      messages: [{ role: "user", content: "今天午餐 45" }],
      scene: "parse",
    });
    const [record] = readLlmUsage();
    expect(record.scene).toBe("parse");
    expect(record.promptTokens).toBe(321);
    expect(record.completionTokens).toBe(45);
    expect(record.totalTokens).toBe(366);
    expect(record.estimated).toBe(false);
    expect(record.ok).toBe(true);
  });

  it("stores a failed row when the model errors out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "额度用完了" } }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      requestLlmChat({
        settings,
        messages: [{ role: "user", content: "hi" }],
        scene: "agent",
      }),
    ).rejects.toThrow("额度用完了");
    const [record] = readLlmUsage();
    expect(record.ok).toBe(false);
    expect(record.error).toBe("额度用完了");
    expect(record.scene).toBe("agent");
  });
});
