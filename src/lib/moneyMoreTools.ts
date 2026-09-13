import { getMonthKey, isValidDateKey } from "./dateRange";
import { evaluateMathExpression } from "./moneyMoreMath";
import { LEDGER_CATEGORIES, getCategoryKind } from "./nlLedgerCategories";
import { categoryEmoji } from "./categoryIcons";
import { buildStatsDashboard } from "./statsDashboard";
import type { LocalLedgerRecord } from "./localLedgerParser";
import {
  moneyMoreRecordId,
  parseMoneyMoreRecordId,
  resolveLedgerCategory,
  type MoneyMoreRecordSnapshot,
} from "./moneyMoreLedgerMutate";

export type MoneyMoreLedgerRecord = {
  id: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  note: string;
  hidden?: boolean;
};

export type MoneyMoreCreateDraft = {
  action: "create";
  records: LocalLedgerRecord[];
};

export type MoneyMoreUpdateDraft = {
  action: "update";
  items: Array<{
    id: string;
    from: MoneyMoreRecordSnapshot;
    to: MoneyMoreRecordSnapshot & { amountText: string };
  }>;
};

export type MoneyMoreDeleteDraft = {
  action: "delete";
  items: MoneyMoreRecordSnapshot[];
};

export type MoneyMoreLedgerDraft =
  MoneyMoreCreateDraft | MoneyMoreUpdateDraft | MoneyMoreDeleteDraft;

export type MoneyMoreToolContext = {
  selectedDate: string;
  defaultCurrency: string;
  currencies: readonly string[];
  records: MoneyMoreLedgerRecord[];
  budget: {
    enabled: boolean;
    currency: string | null;
    monthlyLimit: number | null;
  };
  travelActive: boolean;
  travelName: string | null;
  canMutateLedger: boolean;
  convert: (amount: number, from: string, to: string) => number;
  onStageDraft: (draft: MoneyMoreLedgerDraft) => string;
};

export type MoneyMoreToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const MONEY_MORE_TOOLS: MoneyMoreToolDef[] = [
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "本地计算器。支持 Python 风格算术：+ - * / // % **、括号，以及 abs/sqrt/round/min/max/sum/mean。任何加减乘除、人均、汇率换算草稿都应走这个工具，不要心算。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          expression: { type: "string", description: "例如 (128+56)/3 或 mean(12, 18, 9)" },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_records",
      description: "查询本地账本记录。可按关键词、日期、分类、金额过滤。不要编造未返回的记录。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "匹配备注或分类的关键词，可空" },
          dateFrom: { type: "string", description: "YYYY-MM-DD" },
          dateTo: { type: "string", description: "YYYY-MM-DD" },
          category: { type: "string" },
          currency: { type: "string" },
          limit: { type: "integer", description: "最多返回条数，默认 40，最大 80" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "month_stats",
      description: "按月汇总支出、收入、结余、分类占比和待报销。金额已换算到目标货币。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          month: { type: "string", description: "YYYY-MM，默认当前选中日期所在月" },
          currency: { type: "string", description: "统计货币，默认账本默认货币" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "列出账本全部分类及收支类型。",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_ledger_records",
      description:
        "把对话里确认要记的账单整理成预览。不会立刻写入；用户还需在对话框里点确认。金额支出为正数，工资/退款/报销到账等为负数。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          records: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                date: { type: "string" },
                category: { type: "string" },
                amount: { type: "string", description: "字符串数字，支出为正，收入/退款为负" },
                currency: { type: "string" },
                note: { type: "string" },
              },
              required: ["date", "category", "amount", "currency", "note"],
            },
          },
        },
        required: ["records"],
      },
    },
  },
];

const MONEY_MORE_MUTATE_TOOLS: MoneyMoreToolDef[] = [
  {
    type: "function",
    function: {
      name: "update_ledger_records",
      description:
        "修改已有账单。必须先 search_records 拿到 id。不会立刻写入，用户还需在对话框确认。可改日期、分类、金额、货币、备注。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          records: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: {
                  type: "string",
                  description: "search_records 返回的 id，格式 YYYY-MM-DD:格子序号",
                },
                date: { type: "string" },
                category: { type: "string" },
                amount: { type: "string", description: "字符串数字，支出为正，收入/退款为负" },
                currency: { type: "string" },
                note: { type: "string" },
              },
              required: ["id"],
            },
          },
        },
        required: ["records"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_ledger_records",
      description:
        "删除已有账单。必须先 search_records 拿到 id。不会立刻删除，用户还需在对话框确认。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          ids: {
            type: "array",
            items: { type: "string" },
            description: "search_records 返回的 id 列表",
          },
        },
        required: ["ids"],
      },
    },
  },
];

export const getMoneyMoreTools = (canMutateLedger: boolean): MoneyMoreToolDef[] =>
  canMutateLedger ? [...MONEY_MORE_TOOLS, ...MONEY_MORE_MUTATE_TOOLS] : [...MONEY_MORE_TOOLS];

const MUTATE_DENIED = "未开启删改权限。请到设置打开「允许修改和删除账本」。";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeAmountText = (value: unknown) => {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value !== 0) {
    return String(Math.round(value * 100) / 100);
  }
  const text = asString(value);
  if (/^-?\d+(?:\.\d{1,2})?$/.test(text) && Number(text) !== 0) return text;
  return null;
};

const clip = (text: string, max = 12_000) =>
  text.length <= max ? text : `${text.slice(0, max)}\n…(已截断)`;

export const executeMoneyMoreTool = (
  name: string,
  rawArgs: unknown,
  context: MoneyMoreToolContext,
): string => {
  const args = asRecord(rawArgs);
  try {
    if (name === "calculate") {
      const expression = asString(args.expression);
      const value = evaluateMathExpression(expression);
      return JSON.stringify({ expression, value });
    }
    if (name === "list_categories") {
      return JSON.stringify({
        categories: LEDGER_CATEGORIES.map((category) => ({
          category,
          kind: getCategoryKind(category),
          emoji: categoryEmoji(category),
        })),
        currencies: context.currencies,
        selectedDate: context.selectedDate,
        defaultCurrency: context.defaultCurrency,
      });
    }
    if (name === "search_records") {
      const query = asString(args.query).toLowerCase();
      const dateFrom = asString(args.dateFrom);
      const dateTo = asString(args.dateTo);
      const category = asString(args.category);
      const currency = asString(args.currency).toUpperCase();
      const limit = Math.max(1, Math.min(80, Math.floor(asNumber(args.limit) ?? 40)));
      const matched = context.records.filter((record) => {
        if (record.hidden) return false;
        if (dateFrom && isValidDateKey(dateFrom) && record.date < dateFrom) return false;
        if (dateTo && isValidDateKey(dateTo) && record.date > dateTo) return false;
        if (category && record.category !== category) return false;
        if (currency && record.currency !== currency) return false;
        if (!query) return true;
        return (
          record.note.toLowerCase().includes(query) ||
          record.category.toLowerCase().includes(query) ||
          record.date.includes(query)
        );
      });
      return JSON.stringify({
        total: matched.length,
        records: matched.slice(0, limit).map((record) => ({
          id: record.id || moneyMoreRecordId(record.date, 0),
          date: record.date,
          category: record.category,
          amount: record.amount,
          currency: record.currency,
          note: record.note,
        })),
      });
    }
    if (name === "month_stats") {
      const month = asString(args.month) || getMonthKey(context.selectedDate);
      const currency = (asString(args.currency) || context.defaultCurrency).toUpperCase();
      const monthEntries = context.records
        .filter((record) => !record.hidden && getMonthKey(record.date) === month)
        .map((record) => ({
          date: record.date,
          category: record.category,
          amount: context.convert(record.amount, record.currency, currency),
          note: record.note,
        }));
      const dashboard = buildStatsDashboard({
        monthKey: month,
        entries: monthEntries,
        budgetEnabled: context.budget.enabled,
        monthlyLimit: context.budget.monthlyLimit,
        remainingDays: 1,
      });
      return JSON.stringify({
        month,
        currency,
        kpi: dashboard.kpi,
        topCategories: dashboard.categories.slice(0, 12),
        travelActive: context.travelActive,
        travelName: context.travelName,
      });
    }
    if (name === "draft_ledger_records") {
      const rows = Array.isArray(args.records) ? args.records : [];
      const records: LocalLedgerRecord[] = [];
      for (const row of rows) {
        const item = asRecord(row);
        const date = asString(item.date);
        const category = asString(item.category);
        const amount = asString(item.amount);
        const currency = asString(item.currency).toUpperCase() || context.defaultCurrency;
        const note = asString(item.note);
        if (!isValidDateKey(date) || !category || !amount) continue;
        records.push({ date, category, amount, currency, note });
      }
      if (!records.length) return JSON.stringify({ ok: false, error: "没有有效的待记记录。" });
      const message = context.onStageDraft({ action: "create", records });
      return JSON.stringify({ ok: true, count: records.length, message, records });
    }
    if (name === "update_ledger_records") {
      if (!context.canMutateLedger) return JSON.stringify({ ok: false, error: MUTATE_DENIED });
      const rows = Array.isArray(args.records) ? args.records : [];
      const items: MoneyMoreUpdateDraft["items"] = [];
      for (const row of rows) {
        const item = asRecord(row);
        const id = asString(item.id);
        const current = context.records.find((record) => record.id === id && !record.hidden);
        if (!current || !parseMoneyMoreRecordId(id)) continue;
        const nextDate = asString(item.date) || current.date;
        const nextCategoryName = asString(item.category) || current.category;
        const nextCategory = resolveLedgerCategory(nextCategoryName);
        const amountText = normalizeAmountText(item.amount) ?? String(current.amount);
        const nextCurrency = asString(item.currency).toUpperCase() || current.currency;
        const nextNote = Object.prototype.hasOwnProperty.call(item, "note")
          ? asString(item.note)
          : current.note;
        if (!isValidDateKey(nextDate) || !nextCategory) continue;
        if (!context.currencies.includes(nextCurrency)) continue;
        if (!/^-?\d+(?:\.\d{1,2})?$/.test(amountText) || Number(amountText) === 0) continue;
        const from: MoneyMoreRecordSnapshot = {
          id: current.id,
          date: current.date,
          category: current.category,
          amount: current.amount,
          currency: current.currency,
          note: current.note,
        };
        items.push({
          id,
          from,
          to: {
            id,
            date: nextDate,
            category: nextCategory.name,
            amount: Number(amountText),
            amountText,
            currency: nextCurrency,
            note: nextNote,
          },
        });
      }
      if (!items.length) return JSON.stringify({ ok: false, error: "没有有效的待改记录。" });
      const message = context.onStageDraft({ action: "update", items });
      return JSON.stringify({ ok: true, count: items.length, message, records: items });
    }
    if (name === "delete_ledger_records") {
      if (!context.canMutateLedger) return JSON.stringify({ ok: false, error: MUTATE_DENIED });
      const ids = Array.isArray(args.ids)
        ? args.ids.map((value) => asString(value)).filter(Boolean)
        : [];
      const items: MoneyMoreRecordSnapshot[] = [];
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) continue;
        const current = context.records.find((record) => record.id === id && !record.hidden);
        if (!current || !parseMoneyMoreRecordId(id)) continue;
        seen.add(id);
        items.push({
          id: current.id,
          date: current.date,
          category: current.category,
          amount: current.amount,
          currency: current.currency,
          note: current.note,
        });
      }
      if (!items.length) return JSON.stringify({ ok: false, error: "没有有效的待删记录。" });
      const message = context.onStageDraft({ action: "delete", items });
      return JSON.stringify({ ok: true, count: items.length, message, records: items });
    }
    return JSON.stringify({ error: `未知工具：${name}` });
  } catch (error) {
    return JSON.stringify({
      error: error instanceof Error ? error.message : "工具执行失败。",
    });
  }
};

export const parseToolArguments = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return { expression: trimmed };
  }
};

export const clipToolOutput = (value: string) => clip(value);
