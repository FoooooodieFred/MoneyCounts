import { type ReactNode, useMemo } from "react";
import { CalendarLedger, type CalendarDayEntry } from "./CalendarLedger";
import { useResizableCalendar } from "../hooks/useResizableCalendar";
import { buildLedgerCalendar, type DashboardSourceEntry } from "../lib/statsDashboard";

export type LedgerCalendarLayoutProps = {
  monthKey: string;
  selectedDate: string;
  entries: DashboardSourceEntry[];
  dayEntries: CalendarDayEntry[];
  onSelectDate: (date: string) => void;
  onMonthChange: (month: string) => void;
  children: ReactNode;
};

/** Match the statistics page's right-hand calendar and resizing behavior. */
export function LedgerCalendarLayout({
  monthKey,
  selectedDate,
  entries,
  dayEntries,
  onSelectDate,
  onMonthChange,
  children,
}: LedgerCalendarLayoutProps) {
  const { boardRef, resizing, boardStyle, resizeHandlers } = useResizableCalendar();
  const calendar = useMemo(() => buildLedgerCalendar(monthKey, entries), [monthKey, entries]);

  return (
    <div
      ref={boardRef}
      className={`stats-dashboard${resizing ? " is-resizing" : ""}`}
      style={boardStyle}
    >
      <main className="stats-dashboard__main">{children}</main>
      <CalendarLedger
        calendar={calendar}
        selectedDate={selectedDate}
        dayEntries={dayEntries}
        monthKey={monthKey}
        onSelectDate={onSelectDate}
        onMonthChange={onMonthChange}
        resizeHandlers={resizeHandlers}
      />
    </div>
  );
}
