/**
 * Day-grid slot layout: categoryIndex * MAX_RECORDS_PER_CATEGORY + rowIndex.
 * Old books were 10 categories × 5 / 15 / 50 rows (50 / 150 / 500 slots).
 * Current books are 35 × 50 = 1750 slots. LocalStorage key stays the same.
 */
import {
  LEDGER_CATEGORIES,
  LEGACY_CATEGORY_INDEX_MAP,
  LEGACY_TEN_CATEGORIES,
} from "./nlLedgerCategories";

export const LEGACY_ROWS_PER_CATEGORY = 5;
export const PREVIOUS_MAX_RECORDS_PER_CATEGORY = 15;
export const MAX_RECORDS_PER_CATEGORY = 50;
export const LEGACY_CATEGORY_COUNT = LEGACY_TEN_CATEGORIES.length;

export const CURRENT_DAY_SLOT_COUNT = LEDGER_CATEGORIES.length * MAX_RECORDS_PER_CATEGORY;

export type LegacyDayLayout = "legacy5" | "legacy15" | "legacy50" | "current";

export const detectLegacyDayLayout = (length: number): LegacyDayLayout => {
  if (length <= LEGACY_CATEGORY_COUNT * LEGACY_ROWS_PER_CATEGORY) return "legacy5";
  if (length <= LEGACY_CATEGORY_COUNT * PREVIOUS_MAX_RECORDS_PER_CATEGORY) return "legacy15";
  if (length <= LEGACY_CATEGORY_COUNT * MAX_RECORDS_PER_CATEGORY) return "legacy50";
  return "current";
};

const rowsForLayout = (layout: Exclude<LegacyDayLayout, "current">) => {
  if (layout === "legacy5") return LEGACY_ROWS_PER_CATEGORY;
  if (layout === "legacy15") return PREVIOUS_MAX_RECORDS_PER_CATEGORY;
  return MAX_RECORDS_PER_CATEGORY;
};

export const migrateLegacyDayEntries = <TSource, TDest>(
  source: readonly TSource[],
  makeBlank: () => TDest,
  copy: (item: TSource | undefined) => TDest,
): TDest[] => {
  const layout = detectLegacyDayLayout(source.length);
  if (layout === "current") {
    return Array.from({ length: CURRENT_DAY_SLOT_COUNT }, (_, index) => copy(source[index]));
  }

  const oldRows = rowsForLayout(layout);
  const dest = Array.from({ length: CURRENT_DAY_SLOT_COUNT }, makeBlank);
  for (let oldCat = 0; oldCat < LEGACY_CATEGORY_COUNT; oldCat += 1) {
    const newCat = LEGACY_CATEGORY_INDEX_MAP[oldCat];
    if (newCat < 0) continue;
    for (let row = 0; row < oldRows; row += 1) {
      dest[newCat * MAX_RECORDS_PER_CATEGORY + row] = copy(source[oldCat * oldRows + row]);
    }
  }
  return dest;
};
