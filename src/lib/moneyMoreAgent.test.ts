import { describe, expect, it } from "vitest";
import { buildMoneyMoreSystemMessage, MONEY_MORE_SYSTEM_PROMPT } from "./moneyMoreAgent";
import type { MoneyMoreToolContext } from "./moneyMoreTools";

const context: MoneyMoreToolContext = {
  selectedDate: "2026-09-13",
  defaultCurrency: "HKD",
  currencies: ["HKD", "CNY"],
  records: [
    {
      id: "2026-09-13:0",
      date: "2026-09-13",
      category: "餐饮美食",
      amount: 45,
      currency: "HKD",
      note: "午餐",
    },
  ],
  budget: { enabled: true, currency: "HKD", monthlyLimit: 8000 },
  travelActive: false,
  travelName: null,
  canMutateLedger: false,
  convert: (amount) => amount,
  onStageDraft: () => "",
};

describe("MoneyMore prompt", () => {
  it("tells the model to draft when fields are complete instead of over-asking", () => {
    expect(MONEY_MORE_SYSTEM_PROMPT).toMatch(/立刻 draft/);
    expect(MONEY_MORE_SYSTEM_PROMPT).toMatch(/calculate/);
    expect(MONEY_MORE_SYSTEM_PROMPT).not.toMatch(/先确认日期\/分类\/金额\/货币/);
  });

  it("grounds replies in the selected date, week range and categories", () => {
    const content = buildMoneyMoreSystemMessage(context).content;
    expect(content).toContain("选中日期：2026-09-13");
    expect(content).toContain("2026-09-07 ~ 2026-09-13");
    expect(content).toContain("上一月：2026-08");
    expect(content).toContain("餐饮美食");
    expect(content).toContain("工资收入");
    expect(content).toContain("月预算已开启：8000 HKD");
    expect(content).toContain("删改权限：未开启");
  });

  it("announces mutate permission when enabled", () => {
    const content = buildMoneyMoreSystemMessage({ ...context, canMutateLedger: true }).content;
    expect(content).toContain("删改权限：已开启");
  });
});
