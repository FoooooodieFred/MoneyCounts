import { describe, expect, it } from "vitest";
import { getWeekDates } from "./dateRange";
import {
  NL_LEDGER_ANCHOR_DATE,
  parseNlLedgerDateSpec,
  resolveNlLedgerDateSpec,
} from "./nlLedgerDateSpec";

describe("nlLedgerDateSpec", () => {
  it("uses the documented Monday anchor so week expansion is stable", () => {
    expect(NL_LEDGER_ANCHOR_DATE).toBe("2026-08-31");
    expect(getWeekDates(NL_LEDGER_ANCHOR_DATE)).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });

  it("treats empty spec as the selected/anchor day", () => {
    expect(parseNlLedgerDateSpec("")).toEqual({ type: "anchor" });
    expect(resolveNlLedgerDateSpec("anchor")).toEqual(["2026-08-31"]);
  });

  it("expands today and tomorrow into two ledger days", () => {
    expect(resolveNlLedgerDateSpec("rel:0,1")).toEqual(["2026-08-31", "2026-09-01"]);
  });

  it("expands an inclusive relative span (today through day after tomorrow)", () => {
    expect(resolveNlLedgerDateSpec("span:0:2")).toEqual(["2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  it("expands 这一周每天 into seven Monday-Sunday dates", () => {
    expect(resolveNlLedgerDateSpec("week:0")).toHaveLength(7);
    expect(resolveNlLedgerDateSpec("week:-1")[0]).toBe("2026-08-24");
    expect(resolveNlLedgerDateSpec("week:1")[6]).toBe("2026-09-13");
  });

  it("resolves 本周三 / 上周五 against the current week", () => {
    expect(resolveNlLedgerDateSpec("weekday:3")).toEqual(["2026-09-02"]);
    expect(resolveNlLedgerDateSpec("weekday:-1:5")).toEqual(["2026-08-28"]);
  });

  it("resolves absolute and same-year month-day dates", () => {
    expect(resolveNlLedgerDateSpec("ymd:2026-08-20")).toEqual(["2026-08-20"]);
    expect(resolveNlLedgerDateSpec("md:08-20")).toEqual(["2026-08-20"]);
  });
});
