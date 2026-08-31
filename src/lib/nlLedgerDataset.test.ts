import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CURRENCY_ALIASES } from "./expenseParseShared";
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import { NL_LEDGER_ANCHOR_DATE, resolveNlLedgerDateSpec } from "./nlLedgerDateSpec";

type SampleSpan = { start: number; end: number } | null;

type DatasetSample = {
  id: string;
  lang: "zh" | "en";
  category_id: string;
  category_zh: string;
  kind: "expense" | "income" | "negative_expense";
  text: string;
  amount: string;
  currency: string;
  note: string;
  date_spec: string;
  dates: string[];
  anchor_date: string;
  spans: {
    amount: SampleSpan;
    currency: SampleSpan;
    note: SampleSpan;
  };
};

type CategoryMeta = {
  id: string;
  zh: string;
  en: string;
  kind: DatasetSample["kind"];
};

const root = join(dirname(fileURLToPath(import.meta.url)), "../../data/nl-ledger");

const categories = (
  JSON.parse(readFileSync(join(root, "categories.json"), "utf8")) as { categories: CategoryMeta[] }
).categories;

const samples: DatasetSample[] = readFileSync(join(root, "samples.jsonl"), "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as DatasetSample);

const sliceSpan = (text: string, span: SampleSpan) =>
  span ? text.slice(span.start, span.end) : null;

const unsignedAmount = (amount: string) => amount.replace(/^-/, "");

const countWords = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

describe("nl ledger dataset", () => {
  it("covers 35 categories with 50 Chinese and 50 English rows each", () => {
    expect(categories).toHaveLength(35);
    expect(LEDGER_CATEGORY_DEFS.map((item) => item.id)).toEqual(categories.map((item) => item.id));
    expect(LEDGER_CATEGORY_DEFS.map((item) => item.zh)).toEqual(categories.map((item) => item.zh));
    expect(samples).toHaveLength(35 * 50 * 2);

    for (const category of categories) {
      const zh = samples.filter(
        (sample) => sample.category_id === category.id && sample.lang === "zh",
      );
      const en = samples.filter(
        (sample) => sample.category_id === category.id && sample.lang === "en",
      );
      expect(zh, category.id).toHaveLength(50);
      expect(en, category.id).toHaveLength(50);
      expect(zh.map((sample) => sample.id)).toEqual(
        en.map((sample) => sample.id.replace("-en-", "-zh-")),
      );
    }
  });

  it("keeps paired amount and currency aligned across languages", () => {
    const byId = new Map(samples.map((sample) => [sample.id, sample]));
    for (const sample of samples) {
      if (sample.lang !== "zh") continue;
      const english = byId.get(sample.id.replace("-zh-", "-en-"));
      expect(english, sample.id).toBeTruthy();
      expect(english?.amount).toBe(sample.amount);
      expect(english?.currency).toBe(sample.currency);
      expect(english?.date_spec).toBe(sample.date_spec);
    }
  });

  it("enforces note limits, currencies, signs, and amount mentions", () => {
    const allowed = new Set(Object.keys(CURRENCY_ALIASES));
    for (const sample of samples) {
      expect(allowed.has(sample.currency), sample.id).toBe(true);
      expect(sample.text.includes(unsignedAmount(sample.amount)), sample.id).toBe(true);
      if (sample.lang === "zh") {
        expect([...sample.note].length, sample.note).toBeLessThanOrEqual(10);
      } else {
        expect(countWords(sample.note), sample.note).toBeLessThanOrEqual(10);
      }
      if (sample.kind === "negative_expense") {
        expect(sample.amount.startsWith("-"), sample.id).toBe(true);
        expect(sample.amount).not.toBe("-0");
      } else {
        expect(sample.amount.startsWith("-"), sample.id).toBe(false);
      }
    }
  });

  it("resolves date_spec against the documented Monday anchor", () => {
    expect(NL_LEDGER_ANCHOR_DATE).toBe("2026-08-31");
    for (const sample of samples) {
      expect(sample.anchor_date).toBe(NL_LEDGER_ANCHOR_DATE);
      expect(sample.dates).toEqual(resolveNlLedgerDateSpec(sample.date_spec, sample.anchor_date));
      expect(sample.dates.length).toBeGreaterThan(0);
    }
    const weekly = samples.find((sample) => sample.date_spec === "week:0");
    expect(weekly?.dates).toHaveLength(7);
    const todayTomorrow = samples.find((sample) => sample.date_spec === "rel:0,1");
    expect(todayTomorrow?.dates).toEqual(["2026-08-31", "2026-09-01"]);
  });

  it("keeps amount spans aligned with the unsigned number", () => {
    for (const sample of samples) {
      const amountSpan = sample.spans.amount;
      expect(amountSpan, sample.id).not.toBeNull();
      expect(sliceSpan(sample.text, amountSpan)).toBe(unsignedAmount(sample.amount));
      if (sample.spans.note) {
        expect(sliceSpan(sample.text, sample.spans.note)?.toLowerCase()).toBe(
          sample.note.toLowerCase(),
        );
      }
      if (sample.spans.currency) {
        expect(sliceSpan(sample.text, sample.spans.currency)?.length).toBeGreaterThan(0);
      }
    }
  });
});
