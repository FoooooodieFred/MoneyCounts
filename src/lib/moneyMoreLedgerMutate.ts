import { isValidDateKey } from "./dateRange";
import { CURRENT_DAY_SLOT_COUNT, MAX_RECORDS_PER_CATEGORY } from "./ledgerLayout";
import { getCategoryEntries, getEntryIndex, hasEntryContent, parseAmount } from "./ledgerStats";
import { LEDGER_CATEGORIES, remapLegacyCategoryName } from "./nlLedgerCategories";

export type MoneyMoreMutableEntry = {
  amount: string;
  currency: string;
  note: string;
  hidden?: boolean;
};

export type MoneyMoreMutableLedger = Record<string, MoneyMoreMutableEntry[]>;

export type MoneyMoreRecordSnapshot = {
  id: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  note: string;
};

export const moneyMoreRecordId = (date: string, entryIndex: number) => `${date}:${entryIndex}`;

export const parseMoneyMoreRecordId = (id: string): { date: string; entryIndex: number } | null => {
  const match = /^(\d{4}-\d{2}-\d{2}):(\d+)$/.exec(id.trim());
  if (!match) return null;
  const date = match[1]!;
  const entryIndex = Number(match[2]);
  if (!isValidDateKey(date) || !Number.isInteger(entryIndex) || entryIndex < 0) return null;
  if (entryIndex >= CURRENT_DAY_SLOT_COUNT) return null;
  return { date, entryIndex };
};

export const categoryIndexFromEntryIndex = (entryIndex: number) =>
  Math.floor(entryIndex / MAX_RECORDS_PER_CATEGORY);

export const resolveLedgerCategory = (name: string) => {
  const mapped = remapLegacyCategoryName(name.trim());
  const index = LEDGER_CATEGORIES.indexOf(mapped);
  return index >= 0 ? { name: mapped, index } : null;
};

const cloneDay = (
  entries: MoneyMoreMutableEntry[] | undefined,
  makeBlank: () => MoneyMoreMutableEntry,
) =>
  Array.from({ length: CURRENT_DAY_SLOT_COUNT }, (_, index) => {
    const entry = entries?.[index];
    return entry ? { ...entry } : makeBlank();
  });

const writeCategoryRow = (
  entries: MoneyMoreMutableEntry[],
  categoryIndex: number,
  rowIndex: number,
  entry: MoneyMoreMutableEntry,
) => {
  entries[getEntryIndex(categoryIndex, rowIndex, MAX_RECORDS_PER_CATEGORY)] = entry;
};

const compactCategory = (
  entries: MoneyMoreMutableEntry[],
  categoryIndex: number,
  makeBlank: () => MoneyMoreMutableEntry,
) => {
  const kept = getCategoryEntries(entries, categoryIndex, MAX_RECORDS_PER_CATEGORY).filter(
    hasEntryContent,
  );
  for (let row = 0; row < MAX_RECORDS_PER_CATEGORY; row += 1) {
    writeCategoryRow(entries, categoryIndex, row, kept[row] ?? makeBlank());
  }
};

const firstEmptyRow = (entries: MoneyMoreMutableEntry[], categoryIndex: number) =>
  getCategoryEntries(entries, categoryIndex, MAX_RECORDS_PER_CATEGORY).findIndex(
    (entry) => !hasEntryContent(entry),
  );

const matchesSnapshot = (entry: MoneyMoreMutableEntry, snapshot: MoneyMoreRecordSnapshot) =>
  parseAmount(entry.amount) === snapshot.amount &&
  entry.note === snapshot.note &&
  entry.currency === snapshot.currency;

export type MoneyMoreUpdateApplyItem = {
  id: string;
  from: MoneyMoreRecordSnapshot;
  to: {
    date: string;
    category: string;
    amount: string;
    currency: string;
    note: string;
  };
};

export type MoneyMoreMutateResult = {
  ledger: MoneyMoreMutableLedger;
  affectedDates: string[];
  applied: number;
  messages: string[];
};

const ensureWorkingDay = (
  working: MoneyMoreMutableLedger,
  source: MoneyMoreMutableLedger,
  date: string,
  makeBlank: () => MoneyMoreMutableEntry,
) => {
  if (!working[date]) working[date] = cloneDay(source[date], makeBlank);
  return working[date]!;
};

export const applyMoneyMoreDeletes = (
  ledger: MoneyMoreMutableLedger,
  items: MoneyMoreRecordSnapshot[],
  makeBlank: () => MoneyMoreMutableEntry,
): MoneyMoreMutateResult => {
  const working: MoneyMoreMutableLedger = { ...ledger };
  const messages: string[] = [];
  const touched = new Map<string, Set<number>>();
  let applied = 0;

  for (const item of items) {
    const parsed = parseMoneyMoreRecordId(item.id);
    if (!parsed) {
      messages.push(`无法识别记录 ${item.id}`);
      continue;
    }
    const category = resolveLedgerCategory(item.category);
    const expectedCategory = categoryIndexFromEntryIndex(parsed.entryIndex);
    if (!category || category.index !== expectedCategory) {
      messages.push(`记录 ${item.id} 的分类已变化，已跳过`);
      continue;
    }
    const day = ensureWorkingDay(working, ledger, parsed.date, makeBlank);
    const entry = day[parsed.entryIndex];
    if (!entry || !hasEntryContent(entry) || !matchesSnapshot(entry, item)) {
      messages.push(`记录 ${item.id} 已变化或已不存在，已跳过`);
      continue;
    }
    day[parsed.entryIndex] = makeBlank();
    const set = touched.get(parsed.date) ?? new Set<number>();
    set.add(category.index);
    touched.set(parsed.date, set);
    applied += 1;
  }

  for (const [date, categories] of touched) {
    const day = working[date];
    if (!day) continue;
    for (const categoryIndex of categories) compactCategory(day, categoryIndex, makeBlank);
  }

  return { ledger: working, affectedDates: [...touched.keys()], applied, messages };
};

export const applyMoneyMoreUpdates = (
  ledger: MoneyMoreMutableLedger,
  items: MoneyMoreUpdateApplyItem[],
  makeBlank: () => MoneyMoreMutableEntry,
): MoneyMoreMutateResult => {
  const working: MoneyMoreMutableLedger = { ...ledger };
  const messages: string[] = [];
  const touched = new Map<string, Set<number>>();
  const pendingInserts: Array<{
    date: string;
    categoryIndex: number;
    entry: MoneyMoreMutableEntry;
    label: string;
  }> = [];
  let applied = 0;

  const markTouched = (date: string, categoryIndex: number) => {
    const set = touched.get(date) ?? new Set<number>();
    set.add(categoryIndex);
    touched.set(date, set);
  };

  for (const item of items) {
    const parsed = parseMoneyMoreRecordId(item.id);
    const fromCategory = resolveLedgerCategory(item.from.category);
    const toCategory = resolveLedgerCategory(item.to.category);
    if (!parsed || !fromCategory || !toCategory) {
      messages.push(`无法识别记录 ${item.id}`);
      continue;
    }
    if (fromCategory.index !== categoryIndexFromEntryIndex(parsed.entryIndex)) {
      messages.push(`记录 ${item.id} 的分类已变化，已跳过`);
      continue;
    }
    const sourceDay = ensureWorkingDay(working, ledger, parsed.date, makeBlank);
    const current = sourceDay[parsed.entryIndex];
    if (!current || !hasEntryContent(current) || !matchesSnapshot(current, item.from)) {
      messages.push(`记录 ${item.id} 已变化或已不存在，已跳过`);
      continue;
    }
    const nextEntry: MoneyMoreMutableEntry = {
      amount: item.to.amount,
      currency: item.to.currency,
      note: item.to.note,
      hidden: current.hidden === true,
    };
    const moved = parsed.date !== item.to.date || fromCategory.index !== toCategory.index;
    if (!moved) {
      sourceDay[parsed.entryIndex] = nextEntry;
      markTouched(parsed.date, fromCategory.index);
      applied += 1;
      continue;
    }
    sourceDay[parsed.entryIndex] = makeBlank();
    markTouched(parsed.date, fromCategory.index);
    pendingInserts.push({
      date: item.to.date,
      categoryIndex: toCategory.index,
      entry: nextEntry,
      label: item.id,
    });
  }

  for (const insert of pendingInserts) {
    const day = ensureWorkingDay(working, ledger, insert.date, makeBlank);
    const row = firstEmptyRow(day, insert.categoryIndex);
    if (row < 0) {
      messages.push(
        `${insert.date}「${LEDGER_CATEGORIES[insert.categoryIndex]}」已满，未写入 ${insert.label}`,
      );
      continue;
    }
    writeCategoryRow(day, insert.categoryIndex, row, insert.entry);
    markTouched(insert.date, insert.categoryIndex);
    applied += 1;
  }

  for (const [date, categories] of touched) {
    const day = working[date];
    if (!day) continue;
    for (const categoryIndex of categories) compactCategory(day, categoryIndex, makeBlank);
  }

  return { ledger: working, affectedDates: [...touched.keys()], applied, messages };
};
