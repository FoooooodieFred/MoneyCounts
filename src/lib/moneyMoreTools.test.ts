import { describe, expect, it } from "vitest";
import {
  executeMoneyMoreTool,
  getMoneyMoreTools,
  parseToolArguments,
  type MoneyMoreLedgerDraft,
  type MoneyMoreToolContext,
} from "./moneyMoreTools";

const drafts: MoneyMoreLedgerDraft[] = [];

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
  budget: { enabled: false, currency: null, monthlyLimit: null },
  travelActive: false,
  travelName: null,
  canMutateLedger: false,
  convert: (amount) => amount,
  onStageDraft: (draft) => {
    drafts.push(draft);
    return `${draft.action}:${draft.action === "create" ? draft.records.length : draft.items.length}`;
  },
};

describe("moneyMore tools", () => {
  it("calculates expressions", () => {
    const raw = executeMoneyMoreTool("calculate", { expression: "(10+2)/3" }, context);
    expect(JSON.parse(raw)).toMatchObject({ value: 4 });
  });

  it("searches local records with ids", () => {
    const raw = executeMoneyMoreTool("search_records", { query: "午餐" }, context);
    const parsed = JSON.parse(raw) as {
      total: number;
      records: Array<{ id: string; note: string }>;
    };
    expect(parsed.total).toBe(1);
    expect(parsed.records[0]?.note).toBe("午餐");
    expect(parsed.records[0]?.id).toBe("2026-09-13:0");
  });

  it("drafts ledger records", () => {
    const raw = executeMoneyMoreTool(
      "draft_ledger_records",
      {
        records: [
          {
            date: "2026-09-13",
            category: "餐饮美食",
            amount: "18",
            currency: "HKD",
            note: "咖啡",
          },
        ],
      },
      context,
    );
    expect(JSON.parse(raw)).toMatchObject({ ok: true, count: 1, message: "create:1" });
  });

  it("hides mutate tools until permission is on", () => {
    expect(
      getMoneyMoreTools(false).some((tool) => tool.function.name === "delete_ledger_records"),
    ).toBe(false);
    expect(
      getMoneyMoreTools(true).some((tool) => tool.function.name === "update_ledger_records"),
    ).toBe(true);
  });

  it("refuses delete without permission", () => {
    const raw = executeMoneyMoreTool("delete_ledger_records", { ids: ["2026-09-13:0"] }, context);
    expect(JSON.parse(raw)).toMatchObject({ ok: false });
  });

  it("stages a delete draft when permission is on", () => {
    drafts.length = 0;
    const raw = executeMoneyMoreTool(
      "delete_ledger_records",
      { ids: ["2026-09-13:0"] },
      {
        ...context,
        canMutateLedger: true,
      },
    );
    expect(JSON.parse(raw)).toMatchObject({ ok: true, count: 1, message: "delete:1" });
    expect(drafts[0]).toMatchObject({ action: "delete" });
  });

  it("stages an update draft when permission is on", () => {
    drafts.length = 0;
    const raw = executeMoneyMoreTool(
      "update_ledger_records",
      { records: [{ id: "2026-09-13:0", amount: "50" }] },
      { ...context, canMutateLedger: true },
    );
    expect(JSON.parse(raw)).toMatchObject({ ok: true, count: 1, message: "update:1" });
    expect(drafts[0]).toMatchObject({ action: "update" });
  });

  it("parses tool arguments", () => {
    expect(parseToolArguments('{"expression":"1+1"}')).toEqual({ expression: "1+1" });
  });
});
