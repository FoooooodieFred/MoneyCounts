import { describe, expect, it } from "vitest";
import {
  CURRENT_DAY_SLOT_COUNT,
  detectLegacyDayLayout,
  LEGACY_CATEGORY_COUNT,
  MAX_RECORDS_PER_CATEGORY,
  migrateLegacyDayEntries,
} from "./ledgerLayout";
import { LEDGER_CATEGORIES, LEGACY_CATEGORY_INDEX_MAP } from "./nlLedgerCategories";

describe("ledgerLayout 10-class → 35-class migration", () => {
  it("treats 50 / 150 / 500 slot days as legacy 10-class layouts", () => {
    expect(detectLegacyDayLayout(50)).toBe("legacy5");
    expect(detectLegacyDayLayout(150)).toBe("legacy15");
    expect(detectLegacyDayLayout(500)).toBe("legacy50");
    expect(detectLegacyDayLayout(CURRENT_DAY_SLOT_COUNT)).toBe("current");
  });

  it("moves old 10×50 slots onto the mapped 35-class rows", () => {
    const source = Array.from({ length: LEGACY_CATEGORY_COUNT * MAX_RECORDS_PER_CATEGORY }, () => ({
      amount: "",
    }));
    source[0] = { amount: "12" };
    source[9 * MAX_RECORDS_PER_CATEGORY] = { amount: "8" };

    const migrated = migrateLegacyDayEntries(
      source,
      () => ({ amount: "" }),
      (item) => item ?? { amount: "" },
    );

    expect(migrated).toHaveLength(CURRENT_DAY_SLOT_COUNT);
    expect(migrated[LEGACY_CATEGORY_INDEX_MAP[0] * MAX_RECORDS_PER_CATEGORY]?.amount).toBe("12");
    expect(migrated[LEDGER_CATEGORIES.indexOf("日用百货") * MAX_RECORDS_PER_CATEGORY]?.amount).toBe(
      "8",
    );
    expect(migrated[9 * MAX_RECORDS_PER_CATEGORY]?.amount).toBe("");
  });
});
