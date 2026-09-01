import { describe, expect, it } from "vitest";
import {
  aggregateMonthlyConvertedSpend,
  buildHistoryMonthRows,
  enumerateMonthKeys,
  groupMonthRowsByYear,
  shiftMonthKey,
  yearRowCells,
} from "./yearTrend";

describe("yearTrend", () => {
  it("walks month keys inclusively", () => {
    expect(shiftMonthKey("2025-12", 1)).toBe("2026-01");
    expect(enumerateMonthKeys("2024-11", "2025-02")).toEqual([
      "2024-11",
      "2024-12",
      "2025-01",
      "2025-02",
    ]);
  });

  it("builds a series from the earliest occupied month, filling gaps with zero", () => {
    const totals = aggregateMonthlyConvertedSpend(
      {
        "2018-03-09": [{ amount: "10", currency: "CNY", note: "" }],
        "2020-01-01": [{ amount: "5", currency: "CNY", note: "" }],
        "not-a-date": [{ amount: "99", currency: "CNY", note: "" }],
      },
      (amount) => amount,
    );
    const rows = buildHistoryMonthRows(totals, {
      endMonth: "2020-01",
      todayMonth: "2020-01",
      window: "all",
    });
    expect(rows[0]).toEqual({ month: "2018-03", value: 10 });
    expect(rows.find((row) => row.month === "2019-06")?.value).toBe(0);
    expect(rows.at(-1)).toEqual({ month: "2020-01", value: 5 });
    expect(rows.length).toBe(23);
  });

  it("clips a 12-month window but never before the first record", () => {
    const totals = new Map([
      ["2026-01", 1],
      ["2026-08", 2],
    ]);
    const rows = buildHistoryMonthRows(totals, {
      endMonth: "2026-08",
      todayMonth: "2026-08",
      window: 12,
    });
    expect(rows[0]?.month).toBe("2026-01");
    expect(rows.at(-1)?.month).toBe("2026-08");
  });

  it("groups years and pads missing months as out of range", () => {
    const grouped = groupMonthRowsByYear([
      { month: "2025-11", value: 3 },
      { month: "2026-01", value: 4 },
    ]);
    expect(grouped.map((item) => item.year)).toEqual(["2025", "2026"]);
    const cells = yearRowCells(
      "2025",
      new Map([
        ["2025-11", 3],
        ["2026-01", 4],
      ]),
      "2025-11",
      "2026-01",
    );
    expect(cells[0]?.inRange).toBe(false);
    expect(cells[10]).toEqual({ month: "2025-11", value: 3, inRange: true });
  });
});
