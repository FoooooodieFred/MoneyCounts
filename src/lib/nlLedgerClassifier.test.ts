import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classifyNlLedgerCategory, normalizeNlLedgerClassifierText } from "./nlLedgerClassifier";

const samples = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../data/nl-ledger/samples.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as { text: string; category_zh: string });

describe("nl ledger classifier text normalize", () => {
  it("drops amounts, spend verbs, dates, and currency so n-grams see the descriptor", () => {
    expect(normalizeNlLedgerClassifierText("花了45元买水果")).toBe("买水果");
    expect(normalizeNlLedgerClassifierText("星巴克 38 HKD")).toBe("星巴克");
    expect(normalizeNlLedgerClassifierText("lunch 50 HKD")).toBe("lunch");
    expect(normalizeNlLedgerClassifierText("今天明天都要洗衣服花10HKD")).toBe("洗衣服花");
  });
});

describe("nl ledger classifier probes", () => {
  const probes: Array<[string, string]> = [
    ["星巴克 38 HKD", "餐饮美食"],
    ["地铁来回 10.8HKD", "交通出行"],
    ["发工资 5000", "工资收入"],
    ["淘宝退款50元", "购物退款"],
    ["今天明天都要洗衣服花10HKD", "日用百货"],
    ["lunch 50 HKD", "餐饮美食"],
    ["朋友还我100", "他人还款"],
    ["花了45元买水果", "商超购物"],
    ["公交12", "交通出行"],
    ["报销到账200元", "报销到账"],
    ["会员 68", "休闲娱乐"],
    ["33块钱的充值", "休闲娱乐"],
    ["负30元交通", "交通出行"],
  ];

  it("predicts the shipping probes", () => {
    for (const [text, category] of probes) {
      const prediction = classifyNlLedgerCategory(text);
      expect(prediction?.category, text).toBe(category);
    }
  });

  it("is confident on branded and salary phrases", () => {
    expect(classifyNlLedgerCategory("星巴克 38 HKD")?.confidence).toBeGreaterThan(0.6);
    expect(classifyNlLedgerCategory("发工资 5000")?.confidence).toBeGreaterThan(0.7);
    expect(classifyNlLedgerCategory("朋友还我100")?.confidence).toBeGreaterThan(0.8);
  });
});

describe("nl ledger classifier corpus", () => {
  it("recovers most of the 3500 training utterances", () => {
    let hits = 0;
    for (const sample of samples) {
      if (classifyNlLedgerCategory(sample.text)?.category === sample.category_zh) hits += 1;
    }
    expect(hits / samples.length).toBeGreaterThan(0.8);
  });
});
