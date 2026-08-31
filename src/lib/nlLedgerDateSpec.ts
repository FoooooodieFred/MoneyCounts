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
