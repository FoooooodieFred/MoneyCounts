/**
 * 自然语言记账语料的日期规则：一句话可展开成 1..N 个账本日。
 * 锚点日（语料默认 2026-08-31，周一）对应解析时的 selectedDate。
 * 金额按「每天一笔」复制，不把多日合计摊开。
 */
import { buildDateKey, getWeekDates, isValidDateKey, shiftDateKey } from "./dateRange";

export const NL_LEDGER_ANCHOR_DATE = "2026-08-31";

export type NlLedgerDateSpec =
  | { type: "anchor" }
  | { type: "rel"; offsets: number[] }
  | { type: "week"; weekOffset: -1 | 0 | 1 }
  | { type: "weekday"; weekOffset: -1 | 0 | 1; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
  | { type: "ymd"; date: string }
  | { type: "md"; month: number; day: number }
  | { type: "span"; from: number; to: number };

const WEEK_PREFIX: Record<-1 | 0 | 1, string | undefined> = {
  [-1]: "上",
  0: undefined,
  1: "下",
};

export const parseNlLedgerDateSpec = (spec: string): NlLedgerDateSpec => {
  const trimmed = spec.trim();
  if (!trimmed || trimmed === "anchor") return { type: "anchor" };

  const rel = trimmed.match(/^rel:(-?\d+(?:,-?\d+)*)$/);
  if (rel) {
    const offsets = rel[1].split(",").map((item) => Number(item));
    if (offsets.some((offset) => !Number.isInteger(offset))) {
      throw new Error(`Invalid date_spec: ${spec}`);
    }
    return { type: "rel", offsets };
  }

  const week = trimmed.match(/^week:(-1|0|1)$/);
  if (week) return { type: "week", weekOffset: Number(week[1]) as -1 | 0 | 1 };

  const weekday = trimmed.match(/^weekday:(?:(-1|0|1):)?([1-7])$/);
  if (weekday) {
    return {
      type: "weekday",
      weekOffset: weekday[1] ? (Number(weekday[1]) as -1 | 0 | 1) : 0,
      weekday: Number(weekday[2]) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    };
  }

  const ymd = trimmed.match(/^ymd:(\d{4}-\d{2}-\d{2})$/);
  if (ymd) {
    if (!isValidDateKey(ymd[1])) throw new Error(`Invalid date_spec: ${spec}`);
    return { type: "ymd", date: ymd[1] };
  }

  const md = trimmed.match(/^md:(\d{2})-(\d{2})$/);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    const year = Number(NL_LEDGER_ANCHOR_DATE.slice(0, 4));
    if (!buildDateKey(year, month, day)) throw new Error(`Invalid date_spec: ${spec}`);
    return { type: "md", month, day };
  }

  const span = trimmed.match(/^span:(-?\d+):(-?\d+)$/);
  if (span) {
    const from = Number(span[1]);
    const to = Number(span[2]);
    if (from > to) throw new Error(`Invalid date_spec: ${spec}`);
    return { type: "span", from, to };
  }

  throw new Error(`Unknown date_spec: ${spec}`);
};

export const resolveNlLedgerDateSpec = (
  spec: string | NlLedgerDateSpec,
  anchor = NL_LEDGER_ANCHOR_DATE,
): string[] => {
  if (!isValidDateKey(anchor)) throw new Error(`Invalid anchor date: ${anchor}`);
  const parsed = typeof spec === "string" ? parseNlLedgerDateSpec(spec) : spec;

  switch (parsed.type) {
    case "anchor":
      return [anchor];
    case "rel": {
      const dates = parsed.offsets.map((offset) => shiftDateKey(anchor, offset));
      return [...new Set(dates)];
    }
    case "week":
      return getWeekDates(anchor, WEEK_PREFIX[parsed.weekOffset]);
    case "weekday": {
      const weekDates = getWeekDates(anchor, WEEK_PREFIX[parsed.weekOffset]);
      return [weekDates[parsed.weekday - 1]];
    }
    case "ymd":
      return [parsed.date];
    case "md": {
      const year = Number(anchor.slice(0, 4));
      const date = buildDateKey(year, parsed.month, parsed.day);
      if (!date) throw new Error(`Invalid md date against anchor ${anchor}`);
      return [date];
    }
    case "span": {
      const dates: string[] = [];
      for (let offset = parsed.from; offset <= parsed.to; offset += 1) {
        dates.push(shiftDateKey(anchor, offset));
      }
      return dates;
    }
    default: {
      const _never: never = parsed;
      return _never;
    }
  }
};

export const formatResolvedDates = (dates: readonly string[]) => dates.join("|");

const WEEKDAY_ZH: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 7,
  天: 7,
};

const WEEKDAY_EN: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

const weekOffsetFromPrefix = (prefix: string | undefined): -1 | 0 | 1 => {
  if (prefix === "上" || prefix === "last") return -1;
  if (prefix === "下" || prefix === "next") return 1;
  return 0;
};

const formatWeekdaySpec = (weekOffset: -1 | 0 | 1, weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7) =>
  weekOffset === 0 ? `weekday:${weekday}` : `weekday:${weekOffset}:${weekday}`;

/**
 * Map spoken date language onto a `date_spec` string, then resolve with
 * `resolveNlLedgerDateSpec(spec, selectedDate)`.
 */
export const detectNlLedgerDateSpec = (text: string): string => {
  const weekEveryDay = text.match(/(上|下|本|这)?(?:一)?周(?:每天|每日|天天|每一天|整周|一周七天)/);
  if (weekEveryDay) {
    const offset = weekOffsetFromPrefix(weekEveryDay[1]);
    return `week:${offset}`;
  }

  if (
    /(?:every\s+day|each\s+day|daily).{0,24}(?:this|the)\s+week|(?:this|the)\s+week.{0,24}(?:every\s+day|each\s+day|daily)/i.test(
      text,
    )
  ) {
    return "week:0";
  }
  if (
    /(?:every\s+day|each\s+day|daily).{0,24}last\s+week|last\s+week.{0,24}(?:every\s+day|each\s+day|daily)/i.test(
      text,
    )
  ) {
    return "week:-1";
  }
  if (
    /(?:every\s+day|each\s+day|daily).{0,24}next\s+week|next\s+week.{0,24}(?:every\s+day|each\s+day|daily)/i.test(
      text,
    )
  ) {
    return "week:1";
  }

  const fullDate = text.match(
    /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|20(\d{2})年(\d{1,2})月(\d{1,2})[日号]?/,
  );
  if (fullDate) {
    const year = Number(fullDate[1] ?? `20${fullDate[4]}`);
    const month = Number(fullDate[2] ?? fullDate[5]);
    const day = Number(fullDate[3] ?? fullDate[6]);
    const parsed = buildDateKey(year, month, day);
    if (parsed) return `ymd:${parsed}`;
  }

  const weekdayZh = text.match(/(上|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/);
  if (weekdayZh) {
    const weekday = WEEKDAY_ZH[weekdayZh[2]];
    if (weekday) return formatWeekdaySpec(weekOffsetFromPrefix(weekdayZh[1]), weekday);
  }

  const weekdayEn = text.match(
    /\b(last|this|next)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (weekdayEn) {
    const weekday = WEEKDAY_EN[weekdayEn[2].toLowerCase()];
    if (weekday)
      return formatWeekdaySpec(weekOffsetFromPrefix(weekdayEn[1]?.toLowerCase()), weekday);
  }

  const offsets: number[] = [];
  const add = (offset: number) => {
    if (!offsets.includes(offset)) offsets.push(offset);
  };
  if (/大前天/.test(text)) add(-3);
  else if (/前天|day before yesterday/i.test(text)) add(-2);
  if (/昨天|昨日|\byesterday\b/i.test(text)) add(-1);
  if (/今天|今日|\btoday\b/i.test(text)) add(0);
  if (/明天|\btomorrow\b/i.test(text)) add(1);
  if (/大后天/.test(text)) add(3);
  else if (/后天|day after tomorrow/i.test(text)) add(2);

  if (offsets.length > 1) {
    const unique = [...offsets].sort((a, b) => a - b);
    const min = unique[0];
    const max = unique[unique.length - 1];
    const contiguous =
      unique.length === max - min + 1 && unique.every((item, index) => item === min + index);
    if (contiguous && /到/.test(text)) return `span:${min}:${max}`;
    return `rel:${unique.join(",")}`;
  }
  if (offsets.length === 1) return `rel:${offsets[0]}`;

  const monthDay = text.match(/\b(\d{1,2})[-/.](\d{1,2})\b|(\d{1,2})月(\d{1,2})[日号]?/);
  if (monthDay) {
    const month = Number(monthDay[1] ?? monthDay[3]);
    const day = Number(monthDay[2] ?? monthDay[4]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `md:${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "anchor";
};
