import { describe, expect, it } from "vitest";
import { parseNaturalLedger } from "../localLedgerParser";
import { parseQuickExpense, parseQuickExpenseLines } from "./quickExpenseParser";

const COMPLEX_INPUT =
  "我今天吃了65USD的午餐，33块钱的充值。93元的公交车洗衣服花了78HKD，晚餐300HKD，但是有人A了我85块钱。";

describe("parseQuickExpense note preservation", () => {
  it("keeps merchant name when category keyword matches", () => {
    const result = parseQuickExpense("星巴克 38 HKD", "HKD");
    expect(result?.category).toBe("餐饮");
    expect(result?.note).toBe("星巴克");
    expect(result?.amount).toBe("38");
  });

  it("preserves note text not used for category detection", () => {
    const result = parseQuickExpense("地铁 6元 去公司", "CNY");
    expect(result?.category).toBe("交通");
    expect(result?.note).toBe("去公司");
  });

  it("does not strip unrelated category keywords from note", () => {
    const result = parseQuickExpense("午餐 45 和同事", "CNY");
    expect(result?.note).toBe("和同事");
  });

  it("falls back to descriptive text when only amount is removed", () => {
    const result = parseQuickExpense("45", "CNY");
    expect(result?.note).toBe("");
  });
});

describe("parseQuickExpenseLines — multi-clause Chinese", () => {
  it("parses the canonical complex example (HKD default)", () => {
    const results = parseQuickExpenseLines(COMPLEX_INPUT, "HKD");
    expect(results).toHaveLength(6);
    expect(results[0]).toMatchObject({ category: "餐饮", amount: "65", currency: "USD", note: "午餐" });
    expect(results[1]).toMatchObject({ category: "娱乐", amount: "33", currency: "HKD", note: "充值" });
    expect(results[2]).toMatchObject({ category: "交通", amount: "93", currency: "CNY", note: "公交车" });
    expect(results[3]).toMatchObject({ category: "居住", amount: "78", currency: "HKD", note: "洗衣服" });
    expect(results[4]).toMatchObject({ category: "餐饮", amount: "300", currency: "HKD", note: "晚餐" });
    expect(results[5]).toMatchObject({ category: "餐饮", amount: "-85", currency: "HKD", note: "AA" });
  });

  it("splits on Chinese and English punctuation in one blob", () => {
    const results = parseQuickExpenseLines("午餐45;地铁6元，咖啡18 HKD!", "CNY");
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.category)).toEqual(["餐饮", "交通", "餐饮"]);
  });

  it("handles mixed currencies in one sentence", () => {
    const results = parseQuickExpenseLines("打车120 HKD和午餐88 CNY", "HKD");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ category: "交通", amount: "120", currency: "HKD" });
    expect(results[1]).toMatchObject({ category: "餐饮", amount: "88", currency: "CNY" });
  });

  it("extracts two amounts from one clause", () => {
    const results = parseQuickExpenseLines("93元的公交车洗衣服花了78HKD", "CNY");
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ category: "交通", amount: "93", currency: "CNY", note: "公交车" });
    expect(results[1]).toMatchObject({ category: "居住", amount: "78", currency: "HKD", note: "洗衣服" });
  });

  it("treats AA split as negative income", () => {
    const results = parseQuickExpenseLines("晚餐300HKD，有人A了我85块钱", "HKD");
    expect(results).toHaveLength(2);
    expect(results[1]).toMatchObject({ amount: "-85", note: "AA" });
  });

  it("treats refund keywords as negative", () => {
    const result = parseQuickExpense("淘宝退款50元", "CNY");
    expect(result?.amount).toBe("-50");
  });

  it("treats income and repayment phrases as negative expenses", () => {
    expect(parseQuickExpense("朋友还我100", "CNY")?.amount).toBe("-100");
    expect(parseQuickExpense("发工资 5000", "CNY")?.amount).toBe("-5000");
    expect(parseQuickExpense("工资到账5000", "CNY")?.amount).toBe("-5000");
    expect(parseQuickExpense("退款30", "CNY")?.amount).toBe("-30");
  });

  it("parses English mixed input", () => {
    const result = parseQuickExpense("lunch 50 HKD", "HKD");
    expect(result).toMatchObject({ category: "餐饮", amount: "50", currency: "HKD", note: "lunch" });
  });

  it("infers category from amount-only clause with keyword", () => {
    const result = parseQuickExpense("公交12", "CNY");
    expect(result).toMatchObject({ category: "交通", amount: "12", currency: "CNY" });
  });

  it("handles 花了X元Y doing Z pattern", () => {
    const results = parseQuickExpenseLines("花了45元买水果", "CNY");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ category: "购物", amount: "45", currency: "CNY", note: "水果" });
  });

  it("detects USD amounts", () => {
    const result = parseQuickExpense("吃了65USD的午餐", "CNY");
    expect(result).toMatchObject({ amount: "65", currency: "USD", category: "餐饮" });
  });

  it("uses default currency when unit is ambiguous", () => {
    const result = parseQuickExpense("会员 68", "HKD");
    expect(result?.currency).toBe("HKD");
  });

  it("maps 元 to CNY even when default is HKD", () => {
    const result = parseQuickExpense("地铁6元", "HKD");
    expect(result?.currency).toBe("CNY");
  });

  it("parses multiple newline-separated entries", () => {
    const results = parseQuickExpenseLines("午餐 45\n地铁 6元\n星巴克 38 HKD", "CNY");
    expect(results).toHaveLength(3);
    expect(results[0]?.category).toBe("餐饮");
    expect(results[1]?.category).toBe("交通");
    expect(results[2]?.note).toBe("星巴克");
  });

  it("parses reimbursement as negative", () => {
    const result = parseQuickExpense("报销到账200元", "CNY");
    expect(result?.amount).toBe("-200");
  });

  it("handles explicit negative prefix", () => {
    const result = parseQuickExpense("负30元交通", "CNY");
    expect(result?.amount).toBe("-30");
    expect(result?.category).toBe("交通");
  });

  it("splits 但是 conjunction clauses", () => {
    const results = parseQuickExpenseLines("购物200元，但是退款30元", "CNY");
    expect(results).toHaveLength(2);
    expect(results[1]?.amount).toBe("-30");
  });
});

describe("parseQuickExpenseLines", () => {
  it("returns empty array for blank input", () => {
    expect(parseQuickExpenseLines("  \n  ", "CNY")).toEqual([]);
  });
});

describe("parseNaturalLedger relative dates", () => {
  const context = {
    selectedDate: "2026-06-25",
    defaultCurrency: "CNY",
    categories: [
      "餐饮",
      "交通",
      "购物",
      "居住",
      "通讯",
      "娱乐",
      "医疗",
      "教育",
      "旅行",
      "其他",
    ],
    currencies: ["CNY", "HKD"],
  };

  it("writes quick-entry relative dates to the detected day", async () => {
    const result = await parseNaturalLedger("大前天奶茶20块", context);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      date: "2026-06-22",
      category: "餐饮",
      amount: "20",
      currency: "CNY",
    });
  });

  it("keeps negative income semantics in local natural parsing", async () => {
    const result = await parseNaturalLedger("朋友还我100，工资到账5000，退款30", context);
    expect(result.records.map((record) => record.amount)).toEqual(["-100", "-5000", "-30"]);
  });

  it("expands a whole current week daily commute into one record per day", async () => {
    const result = await parseNaturalLedger("这一周每天地铁来回10.8HKD", context);
    expect(result.records).toHaveLength(7);
    expect(result.records.map((record) => record.date)).toEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
    expect(result.records.every((record) => record.category === "交通")).toBe(true);
    expect(result.records.every((record) => record.amount === "10.8")).toBe(true);
    expect(result.records.every((record) => record.currency === "HKD")).toBe(true);
    expect(result.records.every((record) => record.note === "地铁来回")).toBe(true);
  });

  it("expands today and tomorrow into separate preview records", async () => {
    const result = await parseNaturalLedger("今天明天都要洗衣服花10HKD", context);
    expect(result.records).toHaveLength(2);
    expect(result.records.map((record) => record.date)).toEqual(["2026-06-25", "2026-06-26"]);
    expect(result.records.every((record) => record.category === "居住")).toBe(true);
    expect(result.records.every((record) => record.note === "洗衣服")).toBe(true);
  });
});
