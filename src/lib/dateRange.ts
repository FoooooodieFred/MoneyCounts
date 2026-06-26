export type DateRange = {
  start: string;
  end: string;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getToday = () => formatDateKey(new Date());

export const parseDateKey = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const isValidDateKey = (date: string) => {
  if (!DATE_KEY_PATTERN.test(date)) return false;
  const parsed = parseDateKey(date);
  const [year, month, day] = date.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

export const buildDateKey = (year: number, month: number, day: number) => {
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? formatDateKey(parsed)
    : null;
};

export const shiftDateKey = (date: string, offset: number) => {
  const next = parseDateKey(date);
  next.setDate(next.getDate() + offset);
  return formatDateKey(next);
};

export const formatMonthDay = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
};

export const formatWeekday = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(parseDateKey(date));

export const getMonthKey = (date: string) => date.slice(0, 7);

export const getDaysInMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

export const getWeekRange = (date: string): DateRange => {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  const current = new Date(year, month - 1, dayOfMonth);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDateKey(monday),
    end: formatDateKey(sunday),
  };
};

export const getWeekDates = (selectedDate: string, prefix?: string) => {
  const selected = parseDateKey(selectedDate);
  const currentDay = selected.getDay() || 7;
  const monday = shiftDateKey(selectedDate, 1 - currentDay + (prefix === "上" ? -7 : prefix === "下" ? 7 : 0));
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(monday, index));
};

export const isInRange = (date: string, start: string, end: string) => date >= start && date <= end;

export const getPreviousWeekRange = (weekRange: DateRange): DateRange => ({
  start: shiftDateKey(weekRange.start, -7),
  end: shiftDateKey(weekRange.end, -7),
});

export const getRemainingDaysForBudget = (monthKey: string, today = getToday()) => {
  const currentMonth = getMonthKey(today);
  if (monthKey < currentMonth) return 0;
  if (monthKey > currentMonth) return getDaysInMonth(monthKey);
  return getDaysInMonth(monthKey) - parseDateKey(today).getDate() + 1;
};

export const getLedgerStreak = (recordedDates: Set<string>, anchorDate = getToday()) => {
  let streak = 0;
  let cursor = anchorDate;
  while (recordedDates.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
};
