import { describe, expect, it } from "vitest";
import {
  getRemainingDaysForBudget,
  getWeekDates,
  getWeekRange,
  shiftDateKey,
} from "./dateRange";
import {
  calculateBudgetAvailability,
  calculateMonthlyRecordProgress,
  countRecordedDates,
  countVisibleRecords,
  summarizeLedgerStats,
} from "./ledgerStats";
import { reconcileTravelParticipants } from "../travelMode";

describe("dateRange recurring helpers", () => {
  it("expands the selected natural week from Monday to Sunday", () => {
    expect(getWeekRange("2026-06-25")).toEqual({ start: "2026-06-22", end: "2026-06-28" });
    expect(getWeekDates("2026-06-25")).toEqual([
      "2026-06-22",
      "2026-06-23",
      "2026-06-24",
      "2026-06-25",
      "2026-06-26",
      "2026-06-27",
      "2026-06-28",
    ]);
  });

  it("handles relative day shifts across month boundaries", () => {
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(getRemainingDaysForBudget("2026-06", "2026-06-25")).toBe(6);
  });
});

describe("ledgerStats preservation helpers", () => {
  const ledger = {
    "2026-06-25": [
      { amount: "10", currency: "HKD", note: "coffee" },
      { amount: "", currency: "HKD", note: "" },
      { amount: "12", currency: "HKD", note: "hidden", hidden: true },
    ],
    "2026-06-26": [
      { amount: "-5", currency: "HKD", note: "refund" },
    ],
  };

  it("counts saved records separately from visible statistical records", () => {
    expect(summarizeLedgerStats(ledger)).toEqual({ dateCount: 2, recordCount: 3 });
    expect(countVisibleRecords(ledger["2026-06-25"])).toBe(1);
    expect(countRecordedDates([
      { ...ledger["2026-06-25"][0], date: "2026-06-25" },
      { ...ledger["2026-06-25"][2], date: "2026-06-25" },
      { ...ledger["2026-06-26"][0], date: "2026-06-26" },
    ])).toBe(2);
  });

  it("calculates budget availability and monthly recording progress", () => {
    expect(calculateBudgetAvailability(3000, 1800, 6)).toMatchObject({
      limit: 3000,
      remaining: 1200,
      dailyAvailable: 200,
      percent: 60,
      isOver: false,
    });
    expect(calculateMonthlyRecordProgress(12, 24)).toBe(50);
  });
});

describe("travel participant preservation", () => {
  it("keeps participant ids stable when names are edited", () => {
    const result = reconcileTravelParticipants(
      [
        { id: "person-a", name: "A" },
        { id: "person-b", name: "B" },
      ],
      ["Alice", "Bob"],
      {
        "2026-06-25:0": {
          participantIds: ["person-b"],
          locationLabel: "Tokyo",
        },
      },
    );

    expect(result.participants).toEqual([
      { id: "person-a", name: "Alice" },
      { id: "person-b", name: "Bob" },
    ]);
    expect(result.entryMeta["2026-06-25:0"].participantIds).toEqual(["person-b"]);
  });

  it("falls existing entry split meta back to all participants after removal", () => {
    const result = reconcileTravelParticipants(
      [
        { id: "person-a", name: "A" },
        { id: "person-b", name: "B" },
      ],
      ["Alice"],
      {
        "2026-06-25:0": {
          participantIds: ["person-b"],
          locationLabel: "Tokyo",
        },
      },
    );

    expect(result.participants).toEqual([{ id: "person-a", name: "Alice" }]);
    expect(result.entryMeta["2026-06-25:0"].participantIds).toEqual(["person-a"]);
  });
});
