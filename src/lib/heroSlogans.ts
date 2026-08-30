import { formatMonthDay, getToday, parseDateKey, shiftDateKey } from "./dateRange";

/** Day offset of selectedDate relative to today (selected - today). */
export function getDayOffsetFromToday(selectedDate: string, today = getToday()): number {
  const selected = parseDateKey(selectedDate).getTime();
  const base = parseDateKey(today).getTime();
  return Math.round((selected - base) / 86_400_000);
}

/** Relative day word for nearby dates, else "M月D日". */
export function getRelativeDayPhrase(selectedDate: string, today = getToday()): string {
  const offset = getDayOffsetFromToday(selectedDate, today);
  switch (offset) {
    case 0:
      return "今天";
    case -1:
      return "昨天";
    case 1:
      return "明天";
    case -2:
      return "前天";
    case 2:
      return "后天";
    default:
      return formatMonthDay(selectedDate);
  }
}

/**
 * Six slogan forms. Index 0 is the original「……也要轻松记账」;
 * 1–5 are alternate endings. The leading day phrase swaps with the selected date.
 */
export const HERO_SLOGAN_ENDINGS = [
  "也要轻松记账",
  "也把账记清楚",
  "花的，记一记就好",
  "的开销，慢慢来",
  "也要心里有数",
  "账单，温柔一点",
] as const;

export function pickHeroSloganVariant(selectedDate: string): number {
  const [year, month, day] = selectedDate.split("-").map(Number);
  const ordinal = year * 372 + month * 31 + day;
  return ((ordinal % HERO_SLOGAN_ENDINGS.length) + HERO_SLOGAN_ENDINGS.length) %
    HERO_SLOGAN_ENDINGS.length;
}

export function buildHeroSlogan(
  selectedDate: string,
  variantIndex?: number,
  today = getToday(),
): string {
  const day = getRelativeDayPhrase(selectedDate, today);
  const index = variantIndex ?? pickHeroSloganVariant(selectedDate);
  const ending = HERO_SLOGAN_ENDINGS[index] ?? HERO_SLOGAN_ENDINGS[0];
  return `${day}${ending}`;
}

export function listHeroSloganVariants(selectedDate: string, today = getToday()): string[] {
  const day = getRelativeDayPhrase(selectedDate, today);
  return HERO_SLOGAN_ENDINGS.map((ending) => `${day}${ending}`);
}

/** Convenience for tests / tooling */
export function shiftFromToday(offset: number, today = getToday()) {
  return shiftDateKey(today, offset);
}
