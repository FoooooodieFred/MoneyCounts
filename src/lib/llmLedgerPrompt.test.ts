import { describe, expect, it } from "vitest";
import { LEDGER_CATEGORY_DEFS } from "./nlLedgerCategories";
import {
  buildDefaultLedgerSystemPrompt,
  buildLedgerMessages,
  buildLedgerSystemPrompt,
} from "./llmLedgerPrompt";

const context = {
  selectedDate: "2026-08-31",
  defaultCurrency: "HKD",
  categories: LEDGER_CATEGORY_DEFS.map((item) => item.zh),
  currencies: ["HKD", "CNY"],
};

describe("default ledger prompt", () => {
  it("lists every one of the 35 categories by Chinese name", () => {
    const prompt = buildDefaultLedgerSystemPrompt();
    for (const category of LEDGER_CATEGORY_DEFS) {
      expect(prompt, category.zh).toContain(category.zh);
    }
  });

  it("groups the categories by kind instead of repeating it per line", () => {
    const prompt = buildDefaultLedgerSystemPrompt();
    expect(prompt).toContain("[支出（程序记正数）]");
    expect(prompt).toContain("[收入（程序记负数）]");
    expect(prompt).toContain("[负支出（程序记负数）]");
    // 旧的逐行 kind= 与 id= 写法已经去掉，省下来的 token 用在规则上
    expect(prompt).not.toContain("kind=");
    expect(prompt).not.toContain("id=");
  });

  it("still states the output contract and the date_spec vocabulary", () => {
    const prompt = buildDefaultLedgerSystemPrompt();
    expect(prompt).toContain('"date_spec"');
    expect(prompt).toContain('"category"');
    expect(prompt).toContain('"amount"');
    expect(prompt).toContain('"currency"');
    expect(prompt).toContain('"note"');
    expect(prompt).toContain("anchor");
    expect(prompt).toContain("rel:0,1");
    expect(prompt).toContain("span:0:2");
    expect(prompt).toContain("week:0");
    expect(prompt).toContain("weekday:3");
    expect(prompt).toContain("ymd:2026-08-20");
    expect(prompt).toContain("md:08-20");
  });

  it("keeps the disambiguation rules that change the category", () => {
    const prompt = buildDefaultLedgerSystemPrompt();
    expect(prompt).toContain("他人还款");
    expect(prompt).toContain("票务退款");
    expect(prompt).toContain("日用百货");
    expect(prompt).toContain("AA");
  });
});

describe("custom prompt handling", () => {
  it("uses the default prompt when nothing is customized", () => {
    expect(buildLedgerSystemPrompt("")).toBe(buildDefaultLedgerSystemPrompt());
    expect(buildLedgerSystemPrompt("   ")).toBe(buildDefaultLedgerSystemPrompt());
  });

  it("appends the custom prompt without losing the default rules", () => {
    const merged = buildLedgerSystemPrompt("只要餐饮类", "append");
    expect(merged).toContain("只要餐饮类");
    expect(merged).toContain("用户补充要求");
    // 35 类和 date_spec 规则必须还在
    expect(merged).toContain("餐饮美食");
    expect(merged).toContain("span:0:2");
  });

  it("replaces the default prompt entirely when asked to", () => {
    const replaced = buildLedgerSystemPrompt("只输出日期", "replace");
    expect(replaced).toBe("只输出日期");
    expect(replaced).not.toContain("span:0:2");
  });

  it("puts the chosen system prompt first in the message list", () => {
    const appended = buildLedgerMessages("午餐 45", context, "只要餐饮类", "append");
    expect(appended[0].role).toBe("system");
    expect(appended[0].content).toContain("只要餐饮类");
    expect(appended[1].role).toBe("user");
    expect(appended[1].content).toContain("2026-08-31");
    expect(appended[1].content).toContain("午餐 45");
  });
});
