import type { DashboardCategoryRow, DashboardKpi } from "./statsDashboard";

export type MoneyMoreKpiCard = {
  type: "kpi";
  month: string;
  currency: string;
  kpi: DashboardKpi;
};

export type MoneyMoreCategoriesCard = {
  type: "categories";
  month: string;
  currency: string;
  items: DashboardCategoryRow[];
};

export type MoneyMoreRecordsCard = {
  type: "records";
  total: number;
  items: Array<{
    date: string;
    category: string;
    amount: number;
    currency: string;
    note: string;
  }>;
};

export type MoneyMoreCalcCard = {
  type: "calc";
  expression: string;
  value: number | string;
};

export type MoneyMoreCard =
  MoneyMoreKpiCard | MoneyMoreCategoriesCard | MoneyMoreRecordsCard | MoneyMoreCalcCard;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseKpi = (value: unknown): DashboardKpi | null => {
  const row = asRecord(value);
  if (!row) return null;
  const expense = asNumber(row.expense);
  const income = asNumber(row.income);
  const surplus = asNumber(row.surplus);
  const pendingReimburse = asNumber(row.pendingReimburse);
  const netWorth = asNumber(row.netWorth);
  const totalAssets = asNumber(row.totalAssets);
  const totalLiabilities = asNumber(row.totalLiabilities);
  if (
    expense == null ||
    income == null ||
    surplus == null ||
    pendingReimburse == null ||
    netWorth == null ||
    totalAssets == null ||
    totalLiabilities == null
  ) {
    return null;
  }
  return {
    expense,
    income,
    surplus,
    budgetLimit: asNumber(row.budgetLimit),
    budgetRemaining: asNumber(row.budgetRemaining),
    dailyAvailable: asNumber(row.dailyAvailable),
    pendingReimburse,
    netWorth,
    totalAssets,
    totalLiabilities,
  };
};

const parseCategories = (value: unknown): DashboardCategoryRow[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const category = asString(row.category).trim();
    const amount = asNumber(row.amount);
    const percent = asNumber(row.percent);
    const count = asNumber(row.count);
    if (!category || amount == null || percent == null || count == null) return [];
    return [
      {
        category,
        emoji: asString(row.emoji) || "📌",
        amount,
        percent,
        count,
      },
    ];
  });
};

export const cardsFromToolOutput = (name: string, output: string): MoneyMoreCard[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output) as unknown;
  } catch {
    return [];
  }
  const row = asRecord(parsed);
  if (!row || row.error) return [];

  if (name === "month_stats") {
    const month = asString(row.month).trim();
    const currency = asString(row.currency).trim() || "HKD";
    const kpi = parseKpi(row.kpi);
    const items = parseCategories(row.topCategories);
    const cards: MoneyMoreCard[] = [];
    if (month && kpi) cards.push({ type: "kpi", month, currency, kpi });
    if (month) cards.push({ type: "categories", month, currency, items });
    return cards;
  }

  if (name === "search_records") {
    const total = asNumber(row.total) ?? 0;
    const records = Array.isArray(row.records) ? row.records : [];
    const items = records.flatMap((item) => {
      const record = asRecord(item);
      if (!record) return [];
      const date = asString(record.date);
      const category = asString(record.category);
      const amount = asNumber(record.amount);
      const currency = asString(record.currency) || "HKD";
      if (!date || !category || amount == null) return [];
      return [
        {
          date,
          category,
          amount,
          currency,
          note: asString(record.note),
        },
      ];
    });
    return [{ type: "records", total, items: items.slice(0, 8) }];
  }

  if (name === "calculate") {
    const expression = asString(row.expression).trim();
    const value = row.value;
    if (!expression || (typeof value !== "number" && typeof value !== "string")) return [];
    return [{ type: "calc", expression, value }];
  }

  return [];
};

export const mergeMoneyMoreCards = (cards: MoneyMoreCard[]): MoneyMoreCard[] => {
  const keyed = new Map<string, MoneyMoreCard>();
  const rest: MoneyMoreCard[] = [];
  for (const card of cards) {
    if (card.type === "kpi" || card.type === "categories") {
      keyed.set(`${card.type}:${card.month}:${card.currency}`, card);
      continue;
    }
    rest.push(card);
  }
  const order = ["kpi", "categories"] as const;
  const stats = order.flatMap((type) => [...keyed.values()].filter((card) => card.type === type));
  return [...stats, ...rest];
};
