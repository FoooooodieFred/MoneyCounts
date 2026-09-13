import { KeyboardEvent, PointerEvent } from "react";
import { shiftMonthKey } from "../lib/dateRange";
import type { DashboardCalendarCell } from "../lib/statsDashboard";

export type CalendarDayEntry = {
  category: string;
  amount: string;
  currency: string;
  note: string;
};

type ResizeHandlers = {
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

type CalendarLedgerProps = {
  calendar: DashboardCalendarCell[];
  selectedDate: string;
  dayEntries: CalendarDayEntry[];
  monthKey?: string;
  onSelectDate: (date: string) => void;
  onMonthChange?: (monthKey: string) => void;
  resizeHandlers?: ResizeHandlers;
};

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const compactSigned = (value: number) => {
  if (value === 0) return "0";
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
};

export function CalendarLedger({
  calendar,
  selectedDate,
  dayEntries,
  monthKey,
  onSelectDate,
  onMonthChange,
  resizeHandlers,
}: CalendarLedgerProps) {
  const selectedDayEntries = dayEntries.filter((entry) => entry.note || entry.amount);

  return (
    <aside className="stats-calendar-card" data-section="stats-calendar">
      {resizeHandlers ? (
        <button
          type="button"
          className="stats-calendar__resize"
          aria-label="调整日历账单宽度"
          title="向左拉宽，最宽到页面中线"
          onPointerDown={resizeHandlers.onPointerDown}
          onPointerMove={resizeHandlers.onPointerMove}
          onPointerUp={resizeHandlers.onPointerUp}
          onPointerCancel={resizeHandlers.onPointerCancel}
          onKeyDown={resizeHandlers.onKeyDown}
        />
      ) : null}
      <header className="stats-module-card__head">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>日历账单</h2>
        </div>
        {monthKey && onMonthChange ? (
          <div className="stats-dashboard__month">
            <button
              type="button"
              className="ghost-button"
              aria-label="上个月"
              onClick={() => onMonthChange(shiftMonthKey(monthKey, -1))}
            >
              ‹
            </button>
            <strong>{monthKey}</strong>
            <button
              type="button"
              className="ghost-button"
              aria-label="下个月"
              onClick={() => onMonthChange(shiftMonthKey(monthKey, 1))}
            >
              ›
            </button>
          </div>
        ) : null}
      </header>
      <div className="stats-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="stats-calendar__grid">
        {calendar.map((cell) => (
          <button
            key={cell.date}
            type="button"
            className={`stats-calendar__cell${cell.inMonth ? "" : " is-out"}${
              cell.date === selectedDate ? " is-selected" : ""
            }${cell.hasRecords ? " has-records" : ""}`}
            aria-pressed={cell.date === selectedDate}
            aria-label={`${cell.date}${cell.hasRecords ? `，结余 ${compactSigned(cell.net)}` : ""}`}
            onClick={() => onSelectDate(cell.date)}
          >
            <span>{Number(cell.date.slice(-2))}</span>
            {cell.inMonth && cell.hasRecords ? <em>{compactSigned(cell.net)}</em> : <em />}
          </button>
        ))}
      </div>
      <div className="stats-calendar__day">
        <h3>{selectedDate} 当日账单</h3>
        {selectedDayEntries.length ? (
          <ul>
            {selectedDayEntries.map((entry, index) => (
              <li key={`${entry.category}-${index}`}>
                <span>
                  {entry.category}
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
                <strong>
                  {entry.amount} {entry.currency}
                </strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">这一天还没有账单，点日历可切换日期。</p>
        )}
      </div>
    </aside>
  );
}
