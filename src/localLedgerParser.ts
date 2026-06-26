import {
  CATEGORY_KEYWORDS,
  detectAmount,
  parseExpenseSegment,
  splitExpenseSegments,
} from "./lib/expenseParseShared";
import {
  buildDateKey,
  formatDateKey,
  getWeekDates,
  isValidDateKey,
  parseDateKey,
  shiftDateKey,
} from "./lib/dateRange";

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
  source: "local";
};

const detectWeekday = (text: string, selectedDate: string) => {
  const match = text.match(/(上|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/);
  if (!match) return null;
  const weekdayMap: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    日: 7,
    天: 7,
  };
  const selected = parseDateKey(selectedDate);
  const currentDay = selected.getDay() || 7;
  const targetDay = weekdayMap[match[2]];
  const prefix = match[1];
  let offset = targetDay - currentDay;
  if (prefix === "上") offset -= 7;
  if (prefix === "下") offset += 7;
  return shiftDateKey(selectedDate, offset);
};

const detectDate = (text: string, selectedDate: string) => {
  const fullDate = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|20(\d{2})年(\d{1,2})月(\d{1,2})[日号]?/);
  if (fullDate) {
    const year = Number(fullDate[1] ?? `20${fullDate[4]}`);
    const month = Number(fullDate[2] ?? fullDate[5]);
    const day = Number(fullDate[3] ?? fullDate[6]);
    const parsed = buildDateKey(year, month, day);
    if (parsed) return parsed;
  }

  const [, selectedYear] = selectedDate.match(/^(\d{4})-/) ?? [];
  const monthDay = text.match(/\b(\d{1,2})[-/.](\d{1,2})\b|(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay && selectedYear) {
    const month = Number(monthDay[1] ?? monthDay[3]);
    const day = Number(monthDay[2] ?? monthDay[4]);
    const parsed = buildDateKey(Number(selectedYear), month, day);
    if (parsed) return parsed;
  }

  if (/大前天/.test(text)) return shiftDateKey(selectedDate, -3);
  if (/前天/.test(text)) return shiftDateKey(selectedDate, -2);
  if (/昨天|昨日/.test(text)) return shiftDateKey(selectedDate, -1);
  if (/今天|今日/.test(text)) return selectedDate;
  if (/大后天/.test(text)) return shiftDateKey(selectedDate, 3);
  if (/明天/.test(text)) return shiftDateKey(selectedDate, 1);
  if (/后天/.test(text)) return shiftDateKey(selectedDate, 2);

  return detectWeekday(text, selectedDate);
};

const detectDateTargets = (text: string, selectedDate: string) => {
  const weekEveryDay = text.match(/(上|下|本|这)?(?:一)?周(?:每天|每日|天天|每一天|整周|一周七天)/);
  if (weekEveryDay) return getWeekDates(selectedDate, weekEveryDay[1]);

  const targets: string[] = [];
  const add = (date: string) => {
    if (!targets.includes(date)) targets.push(date);
  };

  if (/大前天/.test(text)) add(shiftDateKey(selectedDate, -3));
  else if (/前天/.test(text)) add(shiftDateKey(selectedDate, -2));
  if (/昨天|昨日/.test(text)) add(shiftDateKey(selectedDate, -1));
  if (/今天|今日/.test(text)) add(selectedDate);
  if (/大后天/.test(text)) add(shiftDateKey(selectedDate, 3));
  else if (/后天/.test(text)) add(shiftDateKey(selectedDate, 2));
  if (/明天/.test(text)) add(shiftDateKey(selectedDate, 1));

  return targets.length ? targets : null;
};

const cleanRecurringNote = (note: string) => {
  let next = note.trim();
  let previous = "";
  while (next && next !== previous) {
    previous = next;
    next = next
      .replace(/^(?:上|下|本|这)?(?:一)?周(?:每天|每日|天天|每一天|整周|一周七天)?/u, "")
      .replace(/^(?:今天|今日|明天|后天|大后天|昨天|昨日|前天|大前天)+/u, "")
      .replace(/^(?:都要|都|每天|每日|天天|每一天|要)+/u, "")
      .trim();
  }
  return next;
};

const restoreRecurringDescriptor = (segment: string, note: string) => {
  let clean = cleanRecurringNote(note).replace(/(?:花了|用了|付了|花费|花)$/u, "").trim();
  if (/地铁.*(?:来回|往返)|(?:来回|往返).*地铁/u.test(segment) && clean === "地铁") {
    return `地铁${segment.includes("往返") ? "往返" : "来回"}`;
  }
  const lowerSegment = segment.toLowerCase();
  const keyword = CATEGORY_KEYWORDS.flatMap(([, keywords]) => keywords)
    .filter((item) => lowerSegment.includes(item.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  if ((/来回|往返/u.test(segment)) && clean === keyword) return `${keyword}${segment.includes("往返") ? "往返" : "来回"}`;
  if (!keyword || clean.includes(keyword)) return clean;
  if (!clean || /^(?:来回|往返|单程|回程)$/u.test(clean)) return `${keyword}${clean}`;
  return clean;
};

export const parseNaturalLedger = async (
  input: string,
  context: LocalLedgerParseContext,
): Promise<LocalLedgerParseResult> => {
  const warnings: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { records: [], warnings: ["请输入自然语言账单。"], source: "local" };

  const fallbackDate = isValidDateKey(context.selectedDate) ? context.selectedDate : formatDateKey(new Date());
  const fallbackCurrency = context.currencies.includes(context.defaultCurrency)
    ? context.defaultCurrency
    : context.currencies[0] ?? "";
  const globalDate = detectDate(trimmed, fallbackDate);
  const segments = splitExpenseSegments(trimmed);
  const records = segments
    .flatMap((segment) => {
      const amount = detectAmount(segment);
      if (!amount) {
        warnings.push(`已跳过未识别金额的片段：${segment}`);
        return [];
      }

      const date = detectDate(segment, fallbackDate) ?? globalDate ?? fallbackDate;
      const targetDates = detectDateTargets(segment, fallbackDate) ?? [date];
      const parsed = parseExpenseSegment(segment, context.categories, context.currencies, fallbackCurrency);
      if (!parsed) return [];

      return targetDates.map((targetDate) => ({
        date: targetDate,
        category: parsed.category,
        amount: parsed.amount,
        currency: parsed.currency,
        note: targetDates.length > 1 ? restoreRecurringDescriptor(`${segment} ${trimmed}`, parsed.note) : cleanRecurringNote(parsed.note),
      }));
    })
    .filter((record): record is LocalLedgerRecord => Boolean(record));

  const normalizedRecords = records.map((record) => {
    if (record.note === "地铁" && /地铁.*(?:来回|往返)|(?:来回|往返).*地铁/u.test(trimmed)) {
      return { ...record, note: `地铁${trimmed.includes("往返") ? "往返" : "来回"}` };
    }
    return record;
  });

  if (!normalizedRecords.length && !warnings.length) warnings.push("未解析出可导入记录，请补充金额或换一种描述。");
  return { records: normalizedRecords, warnings, source: "local" };
};
