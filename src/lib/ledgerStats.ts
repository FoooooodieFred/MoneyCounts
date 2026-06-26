export type LedgerStatsEntry = {
  amount: string;
  currency: string;
  note: string;
  hidden?: boolean;
};

export type LedgerLike = Record<string, LedgerStatsEntry[]>;

export type CollectedLedgerEntry<T extends LedgerStatsEntry = LedgerStatsEntry> = T & {
  date: string;
  entryIndex: number;
  travelKey: string;
  category: string;
};

export const parseAmount = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : 0;
};

export const hasEntryContent = (entry: Pick<LedgerStatsEntry, "amount" | "note">) =>
  Boolean(entry.amount.trim() || entry.note.trim());

export const getEntryIndex = (categoryIndex: number, rowIndex: number, maxRecordsPerCategory: number) =>
  categoryIndex * maxRecordsPerCategory + rowIndex;

export const getCategoryEntries = <T extends LedgerStatsEntry>(
  entries: T[],
  categoryIndex: number,
  maxRecordsPerCategory: number,
) =>
  entries.slice(
    categoryIndex * maxRecordsPerCategory,
    categoryIndex * maxRecordsPerCategory + maxRecordsPerCategory,
  );

export const getDefaultRowCounts = (
  entries: LedgerStatsEntry[],
  categories: readonly string[],
  maxRecordsPerCategory: number,
) =>
  categories.map((_, categoryIndex) => {
    const categoryEntries = getCategoryEntries(entries, categoryIndex, maxRecordsPerCategory);
    const lastContentIndex = categoryEntries.reduce(
      (lastIndex, entry, index) => (hasEntryContent(entry) ? index : lastIndex),
      -1,
    );
    return Math.max(1, lastContentIndex + 1);
  });

export const collectEntries = <T extends LedgerStatsEntry>(
  ledger: Record<string, T[]>,
  categories: readonly string[],
  maxRecordsPerCategory: number,
  predicate: (date: string) => boolean,
): Array<CollectedLedgerEntry<T>> =>
  Object.entries(ledger).flatMap(([date, entries]) =>
    predicate(date)
      ? entries.map((entry, index) => ({
          ...entry,
          date,
          entryIndex: index,
          travelKey: `${date}:${index}`,
          category: categories[Math.floor(index / maxRecordsPerCategory)] ?? "其他",
        }))
      : [],
  );

export const summarizeLedgerStats = (ledger: LedgerLike) => {
  const dates = Object.entries(ledger).filter(([, entries]) => entries.some(hasEntryContent));
  return {
    dateCount: dates.length,
    recordCount: dates.reduce(
      (total, [, entries]) => total + entries.filter((entry) => hasEntryContent(entry)).length,
      0,
    ),
  };
};

export const countVisibleRecords = (entries: LedgerStatsEntry[]) =>
  entries.filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0).length;

export const countRecordedDates = (entries: Array<Pick<CollectedLedgerEntry, "date" | "amount" | "hidden">>) =>
  new Set(entries.filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0).map((entry) => entry.date)).size;

export const calculateBudgetAvailability = (
  monthlyLimit: number | null | undefined,
  spent: number,
  remainingDays: number,
) => {
  const limit = monthlyLimit ?? 0;
  const remaining = limit - spent;
  return {
    limit,
    remaining,
    dailyAvailable: remainingDays > 0 ? Math.max(0, remaining) / remainingDays : 0,
    percent: limit > 0 ? Math.max(0, Math.min(160, (Math.max(0, spent) / limit) * 100)) : 0,
    isOver: limit > 0 && remaining < 0,
  };
};

export const calculateMonthlyRecordProgress = (recordedDayCount: number, elapsedDayCount: number) =>
  Math.min(100, Math.round((recordedDayCount / Math.max(1, elapsedDayCount)) * 100));
