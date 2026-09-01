import { getMonthKey, isValidDateKey } from "./dateRange";
import { parseAmount, type LedgerStatsEntry } from "./ledgerStats";

export type MonthSpendRow = {
  month: string;
  value: number;
};

export type TrendWindow = "all" | 12 | 36;

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export const isMonthKey = (value: string): boolean => MONTH_KEY_PATTERN.test(value);

export const shiftMonthKey = (monthKey: string, offset: number): string => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const maxMonthKey = (...keys: Array<string | undefined | null>): string => {
  const valid = keys.filter((key): key is string => Boolean(key && isMonthKey(key)));
  return valid.sort()[valid.length - 1] ?? "";
};

export const enumerateMonthKeys = (start: string, end: string): string[] => {
  if (!isMonthKey(start) || !isMonthKey(end) || start > end) return [];
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
    if (keys.length > 720) break;
  }
  return keys;
};

export const aggregateMonthlyConvertedSpend = (
  ledger: Record<string, LedgerStatsEntry[]>,
  convertAmount: (amount: number, currency: string) => number,
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const [date, entries] of Object.entries(ledger)) {
    if (!isValidDateKey(date)) continue;
    const month = getMonthKey(date);
    for (const entry of entries) {
      if (entry.hidden) continue;
      const amount = parseAmount(entry.amount);
      if (!amount) continue;
      totals.set(month, (totals.get(month) ?? 0) + convertAmount(amount, entry.currency));
    }
  }
  return totals;
};

export const occupiedMonthKeys = (totals: Map<string, number>): string[] =>
  [...totals.entries()]
    .filter(([, value]) => value !== 0)
    .map(([month]) => month)
    .sort();

export const buildHistoryMonthRows = (
  totals: Map<string, number>,
  options: { endMonth: string; todayMonth: string; window: TrendWindow },
): MonthSpendRow[] => {
  const occupied = occupiedMonthKeys(totals);
  if (!occupied.length) return [];
  const earliest = occupied[0];
  const latestOccupied = occupied[occupied.length - 1];
  const end = maxMonthKey(options.endMonth, options.todayMonth, latestOccupied);
  let start = earliest;
  if (options.window !== "all") {
    const windowStart = shiftMonthKey(end, 1 - options.window);
    start = windowStart > earliest ? windowStart : earliest;
  }
  return enumerateMonthKeys(start, end).map((month) => ({
    month,
    value: totals.get(month) ?? 0,
  }));
};

export const groupMonthRowsByYear = (
  rows: MonthSpendRow[],
): Array<{ year: string; months: MonthSpendRow[] }> => {
  const years: Array<{ year: string; months: MonthSpendRow[] }> = [];
  const index = new Map<string, MonthSpendRow[]>();
  for (const row of rows) {
    const year = row.month.slice(0, 4);
    let bucket = index.get(year);
    if (!bucket) {
      bucket = [];
      index.set(year, bucket);
      years.push({ year, months: bucket });
    }
    bucket.push(row);
  }
  return years;
};

export const yearRowCells = (
  year: string,
  rowsByMonth: Map<string, number>,
  rangeStart: string,
  rangeEnd: string,
): Array<{ month: string; value: number; inRange: boolean }> =>
  Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return {
      month,
      value: rowsByMonth.get(month) ?? 0,
      inRange: month >= rangeStart && month <= rangeEnd,
    };
  });
