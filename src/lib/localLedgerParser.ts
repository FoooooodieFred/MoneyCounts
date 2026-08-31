/**
 * 本地规则解析入口（中英多句 → 可预览记录）。
 * 首页快速记账与旅游自然语言录入共用 `parseNaturalLedger`；
 * 日期用 `date_spec` 展开（每天复制同一金额），分词与金额委托 `expenseParseShared`。
 * 改动行为前请跑 `npm test`（quickExpenseParser / nlLedgerDateSpec / refactorPreservation）。
 */
import {
  CATEGORY_KEYWORDS,
  detectAmount,
  parseExpenseSegment,
  splitExpenseSegments,
} from "./expenseParseShared";
import { formatDateKey, isValidDateKey } from "./dateRange";
import { detectNlLedgerDateSpec, resolveNlLedgerDateSpec } from "./nlLedgerDateSpec";

export type LocalLedgerRecord = {
  date: string;
  category: string;
  amount: string;
  currency: string;
  note: string;
  hidden?: boolean;
};

export type LocalLedgerParseContext = {
  selectedDate: string;
  defaultCurrency: string;
  categories: readonly string[];
  currencies: readonly string[];
};

export type LocalLedgerParseResult = {
  records: LocalLedgerRecord[];
  warnings: string[];
  source: "local" | "llm";
};

const resolveSingleDayFallbackSpec = (text: string, selectedDate: string) => {
  const spec = detectNlLedgerDateSpec(text);
  const dates = resolveNlLedgerDateSpec(spec, selectedDate);
  return dates.length === 1 ? spec : "anchor";
};

const cleanRecurringNote = (note: string) => {
  let next = note.trim();
  let previous = "";
  while (next && next !== previous) {
    previous = next;
    next = next
      .replace(/^(?:上|下|本|这)?(?:一)?周(?:每天|每日|天天|每一天|整周|一周七天)?/u, "")
      .replace(/^(?:today|yesterday|tomorrow|this week|last week|next week)+/iu, "")
      .replace(/^(?:今天|今日|明天|后天|大后天|昨天|昨日|前天|大前天)+/u, "")
      .replace(/^(?:都要|都|每天|每日|天天|每一天|要)+/u, "")
      .trim();
  }
  return next;
};

const restoreRecurringDescriptor = (segment: string, note: string) => {
  const clean = cleanRecurringNote(note)
    .replace(/(?:花了|用了|付了|花费|花)$/u, "")
    .trim();
  if (/地铁.*(?:来回|往返)|(?:来回|往返).*地铁/u.test(segment) && clean === "地铁") {
    return `地铁${segment.includes("往返") ? "往返" : "来回"}`;
  }
  const lowerSegment = segment.toLowerCase();
  const keyword = CATEGORY_KEYWORDS.flatMap(([, keywords]) => keywords)
    .filter((item) => lowerSegment.includes(item.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if (/来回|往返/u.test(segment) && clean === keyword)
    return `${keyword}${segment.includes("往返") ? "往返" : "来回"}`;
  if (!keyword || clean.includes(keyword)) return clean;
  if (!clean || /^(?:来回|往返|单程|回程)$/u.test(clean)) return `${keyword}${clean}`;
  return clean;
};

/** 自然语言多句解析主入口；返回 records + warnings，由 UI 预览确认后再写入。 */
export const parseNaturalLedger = async (
  input: string,
  context: LocalLedgerParseContext,
): Promise<LocalLedgerParseResult> => {
  const warnings: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { records: [], warnings: ["请输入自然语言账单。"], source: "local" };

  const fallbackDate = isValidDateKey(context.selectedDate)
    ? context.selectedDate
    : formatDateKey(new Date());
  const fallbackCurrency = context.currencies.includes(context.defaultCurrency)
    ? context.defaultCurrency
    : (context.currencies[0] ?? "");
  const globalFallbackSpec = resolveSingleDayFallbackSpec(trimmed, fallbackDate);
  const segments = splitExpenseSegments(trimmed);
  const records = segments
    .flatMap((segment) => {
      const amount = detectAmount(segment);
      if (!amount) {
        warnings.push(`已跳过未识别金额的片段：${segment}`);
        return [];
      }

      const segmentSpec = detectNlLedgerDateSpec(segment);
      const spec = segmentSpec !== "anchor" ? segmentSpec : globalFallbackSpec;
      const targetDates = resolveNlLedgerDateSpec(spec, fallbackDate);
      const parsed = parseExpenseSegment(
        segment,
        context.categories,
        context.currencies,
        fallbackCurrency,
      );
      if (!parsed) return [];

      return targetDates.map((targetDate) => ({
        date: targetDate,
        category: parsed.category,
        amount: parsed.amount,
        currency: parsed.currency,
        note:
          targetDates.length > 1
            ? restoreRecurringDescriptor(`${segment} ${trimmed}`, parsed.note)
            : cleanRecurringNote(parsed.note),
      }));
    })
    .filter((record): record is LocalLedgerRecord => Boolean(record));

  const normalizedRecords = records.map((record) => {
    if (record.note === "地铁" && /地铁.*(?:来回|往返)|(?:来回|往返).*地铁/u.test(trimmed)) {
      return { ...record, note: `地铁${trimmed.includes("往返") ? "往返" : "来回"}` };
    }
    return record;
  });

  if (!normalizedRecords.length && !warnings.length)
    warnings.push("未解析出可导入记录，请补充金额或换一种描述。");
  return { records: normalizedRecords, warnings, source: "local" };
};
