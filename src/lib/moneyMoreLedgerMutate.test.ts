import { describe, expect, it } from "vitest";
import { CURRENT_DAY_SLOT_COUNT, MAX_RECORDS_PER_CATEGORY } from "./ledgerLayout";
import { parseAmount } from "./ledgerStats";
import {
  applyMoneyMoreDeletes,
  applyMoneyMoreUpdates,
  moneyMoreRecordId,
  parseMoneyMoreRecordId,
} from "./moneyMoreLedgerMutate";

const blank = () => ({ amount: "", currency: "HKD", note: "" });
const emptyDay = () => Array.from({ length: CURRENT_DAY_SLOT_COUNT }, blank);
const slot = (amount: string, note: string, currency = "HKD") => ({ amount, currency, note });

describe("moneyMore ledger mutate", () => {
  it("parses record ids", () => {
    expect(parseMoneyMoreRecordId("2026-09-13:0")).toEqual({ date: "2026-09-13", entryIndex: 0 });
    expect(parseMoneyMoreRecordId("bad")).toBeNull();
  });

  it("deletes a record and compacts the category", () => {
    const date = "2026-09-13";
    const day = emptyDay();
    day[0] = slot("45", "午餐");
    day[1] = slot("18", "咖啡");
    const lunchId = moneyMoreRecordId(date, 0);
    const result = applyMoneyMoreDeletes(
      { [date]: day },
      [
        {
          id: lunchId,
          date,
          category: "餐饮美食",
          amount: 45,
          currency: "HKD",
          note: "午餐",
        },
      ],
      blank,
    );
    expect(result.applied).toBe(1);
    expect(parseAmount(result.ledger[date]![0]!.amount)).toBe(18);
    expect(result.ledger[date]![0]!.note).toBe("咖啡");
    expect(parseAmount(result.ledger[date]![1]!.amount)).toBe(0);
  });

  it("skips deletes when the snapshot no longer matches", () => {
    const date = "2026-09-13";
    const day = emptyDay();
    day[0] = slot("50", "午餐");
    const result = applyMoneyMoreDeletes(
      { [date]: day },
      [
        {
          id: moneyMoreRecordId(date, 0),
          date,
          category: "餐饮美食",
          amount: 45,
          currency: "HKD",
          note: "午餐",
        },
      ],
      blank,
    );
    expect(result.applied).toBe(0);
    expect(parseAmount(result.ledger[date]![0]!.amount)).toBe(50);
  });

  it("updates amount in place and can move to another category", () => {
    const date = "2026-09-13";
    const day = emptyDay();
    day[0] = slot("45", "午餐");
    const id = moneyMoreRecordId(date, 0);
    const from = {
      id,
      date,
      category: "餐饮美食",
      amount: 45,
      currency: "HKD",
      note: "午餐",
    };
    const patched = applyMoneyMoreUpdates(
      { [date]: day },
      [
        {
          id,
          from,
          to: { date, category: "餐饮美食", amount: "50", currency: "HKD", note: "午餐" },
        },
      ],
      blank,
    );
    expect(patched.applied).toBe(1);
    expect(patched.ledger[date]![0]!.amount).toBe("50");

    const moved = applyMoneyMoreUpdates(
      patched.ledger,
      [
        {
          id,
          from: { ...from, amount: 50 },
          to: { date, category: "交通出行", amount: "50", currency: "HKD", note: "午餐" },
        },
      ],
      blank,
    );
    expect(moved.applied).toBe(1);
    expect(parseAmount(moved.ledger[date]![0]!.amount)).toBe(0);
    expect(moved.ledger[date]![MAX_RECORDS_PER_CATEGORY]!.note).toBe("午餐");
    expect(moved.ledger[date]![MAX_RECORDS_PER_CATEGORY]!.amount).toBe("50");
  });
});
