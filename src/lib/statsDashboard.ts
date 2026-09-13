import { categoryEmoji } from "./categoryIcons";
import { buildMonthCalendarCells, listMonthDateKeys } from "./dateRange";
import { getCategoryKind } from "./nlLedgerCategories";

export type DashboardFlow = "expense" | "income" | "surplus";
export type NetWorthSeries = "netWorth" | "assets" | "liabilities";

export type DashboardSourceEntry = {
  date: string;
  category: string;
  amount: number;
  note: string;
};

export type DashboardKpi = {
  expense: number;
  income: number;
  surplus: number;
  budgetLimit: number | null;
  budgetRemaining: number | null;
  dailyAvailable: number | null;
  pendingReimburse: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

export type DashboardDayBar = {
  date: string;
  day: number;
  expense: number;
  income: number;
  surplus: number;
};

export type DashboardCategoryRow = {
  category: string;
  emoji: string;
  amount: number;
  percent: number;
  count: number;
};

export type DashboardNetPoint = {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
};

export type DashboardCalendarCell = {
  date: string;
  inMonth: boolean;
  net: number;
  hasRecords: boolean;
};

const PENDING_NOTE = /待报销|未报销|报销中/;
const SETTLED_NOTE = /已报销|报销到账/;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const splitFlow = (entry: DashboardSourceEntry) => {
  const kind = getCategoryKind(entry.category);
  const abs = Math.abs(entry.amount);
  if (kind === "income") return { expense: 0, income: abs };
  if (kind === "negative_expense") return { expense: 0, income: abs };
  if (entry.amount < 0) return { expense: 0, income: abs };
  return { expense: abs, income: 0 };
};

export const isPendingReimbursement = (entry: Pick<DashboardSourceEntry, "note" | "category">) => {
  const note = entry.note.trim();
  if (!note) return false;
  if (SETTLED_NOTE.test(note)) return false;
  if (PENDING_NOTE.test(note)) return true;
  return /报销/.test(note) && getCategoryKind(entry.category) === "expense";
};

export const buildStatsDashboard = (options: {
  monthKey: string;
  entries: DashboardSourceEntry[];
  budgetEnabled: boolean;
  monthlyLimit: number | null;
  remainingDays: number;
}): {
  kpi: DashboardKpi;
  dailyBars: DashboardDayBar[];
  averageExpense: number;
  averageIncome: number;
  averageSurplus: number;
  categories: DashboardCategoryRow[];
  netSeries: DashboardNetPoint[];
  calendar: DashboardCalendarCell[];
} => {
  const { monthKey, entries, budgetEnabled, monthlyLimit, remainingDays } = options;
  const visible = entries.filter((entry) => entry.amount !== 0);
  const dates = listMonthDateKeys(monthKey);
  const byDate = new Map<string, DashboardSourceEntry[]>();
  for (const date of dates) byDate.set(date, []);
  for (const entry of visible) {
    const bucket = byDate.get(entry.date);
    if (bucket) bucket.push(entry);
  }

  let expense = 0;
  let income = 0;
  let pendingReimburse = 0;
  const categoryMap = new Map<string, { amount: number; count: number }>();

  const dailyBars: DashboardDayBar[] = dates.map((date) => {
    const dayEntries = byDate.get(date) ?? [];
    let dayExpense = 0;
    let dayIncome = 0;
    for (const entry of dayEntries) {
      const flow = splitFlow(entry);
      dayExpense += flow.expense;
      dayIncome += flow.income;
      if (flow.expense > 0) {
        const current = categoryMap.get(entry.category) ?? { amount: 0, count: 0 };
        current.amount += flow.expense;
        current.count += 1;
        categoryMap.set(entry.category, current);
      }
      if (isPendingReimbursement(entry)) pendingReimburse += flow.expense || Math.abs(entry.amount);
    }
    expense += dayExpense;
    income += dayIncome;
    const surplus = dayIncome - dayExpense;
    return {
      date,
      day: Number(date.slice(-2)),
      expense: roundMoney(dayExpense),
      income: roundMoney(dayIncome),
      surplus: roundMoney(surplus),
    };
  });

  const recordedBars = dailyBars.filter(
    (row) => row.expense !== 0 || row.income !== 0 || row.surplus !== 0,
  );
  const averageExpense = recordedBars.length ? expense / recordedBars.length : 0;
  const averageIncome = recordedBars.length ? income / recordedBars.length : 0;
  const averageSurplus = recordedBars.length ? (income - expense) / recordedBars.length : 0;
  const surplus = income - expense;
  const budgetLimit = budgetEnabled && monthlyLimit && monthlyLimit > 0 ? monthlyLimit : null;
  const budgetRemaining = budgetLimit == null ? null : budgetLimit - expense;
  const dailyAvailable =
    budgetRemaining == null
      ? null
      : remainingDays > 0
        ? Math.max(0, budgetRemaining) / remainingDays
        : 0;

  const categoryTotal = Array.from(categoryMap.values()).reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const categories = Array.from(categoryMap.entries())
    .map(([category, item]) => ({
      category,
      emoji: categoryEmoji(category),
      amount: roundMoney(item.amount),
      percent: categoryTotal ? (item.amount / categoryTotal) * 100 : 0,
      count: item.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  let runningAssets = 0;
  let runningLiabilities = 0;
  const netSeries: DashboardNetPoint[] = dailyBars.map((row) => {
    runningAssets += row.income;
    runningLiabilities += row.expense;
    return {
      date: row.date,
      assets: roundMoney(runningAssets),
      liabilities: roundMoney(runningLiabilities),
      netWorth: roundMoney(runningAssets - runningLiabilities),
    };
  });

  const netByDate = new Map(dailyBars.map((row) => [row.date, row.surplus]));
  const calendar = buildMonthCalendarCells(monthKey).map((cell) => ({
    date: cell.date,
    inMonth: cell.inMonth,
    net: cell.inMonth ? (netByDate.get(cell.date) ?? 0) : 0,
    hasRecords: cell.inMonth ? Boolean((byDate.get(cell.date) ?? []).length) : false,
  }));

  return {
    kpi: {
      expense: roundMoney(expense),
      income: roundMoney(income),
      surplus: roundMoney(surplus),
      budgetLimit,
      budgetRemaining: budgetRemaining == null ? null : roundMoney(budgetRemaining),
      dailyAvailable: dailyAvailable == null ? null : roundMoney(dailyAvailable),
      pendingReimburse: roundMoney(pendingReimburse),
      netWorth: roundMoney(surplus),
      totalAssets: roundMoney(income),
      totalLiabilities: roundMoney(expense),
    },
    dailyBars,
    averageExpense: roundMoney(averageExpense),
    averageIncome: roundMoney(averageIncome),
    averageSurplus: roundMoney(averageSurplus),
    categories,
    netSeries,
    calendar,
  };
};

export const metricForBar = (row: DashboardDayBar, flow: DashboardFlow) =>
  flow === "expense" ? row.expense : flow === "income" ? row.income : row.surplus;

export const metricForNet = (row: DashboardNetPoint, series: NetWorthSeries) =>
  series === "assets" ? row.assets : series === "liabilities" ? row.liabilities : row.netWorth;

export const extremeBarDates = (rows: DashboardDayBar[], flow: DashboardFlow) => {
  const recorded = rows.filter((row) => metricForBar(row, flow) !== 0);
  if (!recorded.length) return new Set<string>();
  let min = recorded[0];
  let max = recorded[0];
  for (const row of recorded) {
    const value = metricForBar(row, flow);
    if (value < metricForBar(min, flow)) min = row;
    if (value > metricForBar(max, flow)) max = row;
  }
  return new Set([min.date, max.date]);
};
