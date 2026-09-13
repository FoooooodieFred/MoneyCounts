import { useMemo } from "react";
import { CalendarLedger, type CalendarDayEntry } from "../components/CalendarLedger";
import { SummaryModeToggle } from "../components/StatsControls";
import { categoryEmoji } from "../lib/categoryIcons";
import { getRemainingDaysForBudget } from "../lib/dateRange";
import { useResizableCalendar } from "../hooks/useResizableCalendar";
import { buildStatsDashboard, type DashboardSourceEntry } from "../lib/statsDashboard";

type DaySummaryPageProps = {
  selectedDate: string;
  weekdayLabel: string;
  monthKey: string;
  summaryMode: "split" | "merged";
  splitCurrencies: string[];
  dayTotals: {
    native: Record<string, number>;
    converted: Record<string, number>;
  };
  dailyDefaultCurrency: string;
  formatMoney: (amount: number, currency: string) => string;
  getCurrencyLabel: (currency: string) => string;
  entries: DashboardSourceEntry[];
  dayEntries: CalendarDayEntry[];
  onSummaryModeChange: (mode: "split" | "merged") => void;
  onSelectDate: (date: string) => void;
  onMonthChange: (monthKey: string) => void;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
};

export function DaySummaryPage({
  selectedDate,
  weekdayLabel,
  monthKey,
  summaryMode,
  splitCurrencies,
  dayTotals,
  dailyDefaultCurrency,
  formatMoney,
  getCurrencyLabel,
  entries,
  dayEntries,
  onSummaryModeChange,
  onSelectDate,
  onMonthChange,
  onPrevDay,
  onToday,
  onNextDay,
}: DaySummaryPageProps) {
  const { boardRef, resizing, boardStyle, resizeHandlers } = useResizableCalendar();
  const remainingDays = getRemainingDaysForBudget(monthKey, selectedDate);
  const dashboard = useMemo(
    () =>
      buildStatsDashboard({
        monthKey,
        entries,
        budgetEnabled: false,
        monthlyLimit: null,
        remainingDays,
      }),
    [entries, monthKey, remainingDays],
  );

  const billedEntries = dayEntries.filter((entry) => entry.note || entry.amount);
  const categoryRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of dayEntries) {
      if (!entry.note && !entry.amount) continue;
      counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
    }
    return Array.from(counts.entries());
  }, [dayEntries]);

  return (
    <div
      className="app-shell app-shell--below-nav stats-dashboard-shell day-summary-shell"
      data-section="screen-day"
    >
      <div
        ref={boardRef}
        className={`stats-dashboard${resizing ? " is-resizing" : ""}`}
        style={boardStyle}
      >
        <div className="stats-dashboard__main">
          <header className="stats-dashboard__head">
            <div>
              <p className="eyebrow">Day ledger</p>
              <h1>当日汇总</h1>
              <p className="muted">
                {selectedDate} · {weekdayLabel}
              </p>
            </div>
            <div className="day-summary__nav" aria-label="日期导航">
              <button type="button" className="secondary-button" onClick={onPrevDay}>
                ‹ 前一天
              </button>
              <button type="button" className="secondary-button" onClick={onToday}>
                今天
              </button>
              <button type="button" className="secondary-button" onClick={onNextDay}>
                后一天 ›
              </button>
            </div>
          </header>

          <section className="stats-module-card" data-section="day-totals">
            <header className="stats-module-card__head">
              <div>
                <p className="eyebrow">Totals</p>
                <h2>分币种合计</h2>
              </div>
              <SummaryModeToggle mode={summaryMode} onChange={onSummaryModeChange} />
            </header>
            <div className="stats-kpi-grid day-summary__kpis">
              {summaryMode === "split" ? (
                splitCurrencies.length ? (
                  splitCurrencies.map((currency) => (
                    <article key={currency} className="stats-kpi-card">
                      <span>{getCurrencyLabel(currency)}</span>
                      <strong>{formatMoney(dayTotals.native[currency], currency)}</strong>
                    </article>
                  ))
                ) : (
                  <p className="muted">这一天还没有支出。</p>
                )
              ) : (
                <article className="stats-kpi-card">
                  <span>{dailyDefaultCurrency} 合并口径</span>
                  <strong>
                    {formatMoney(dayTotals.converted[dailyDefaultCurrency], dailyDefaultCurrency)}
                  </strong>
                </article>
              )}
              <article className="stats-kpi-card">
                <span>记账笔数</span>
                <strong>{billedEntries.length}</strong>
              </article>
            </div>
          </section>

          <section className="stats-module-card" data-section="day-categories">
            <header className="stats-module-card__head">
              <div>
                <p className="eyebrow">Categories</p>
                <h2>当日分类</h2>
              </div>
            </header>
            {categoryRows.length ? (
              <ul className="stats-category-list day-summary__categories">
                {categoryRows.map(([category, count]) => (
                  <li key={category}>
                    <span>
                      {categoryEmoji(category)} {category}
                    </span>
                    <small>{count} 笔</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">点右侧日历换一天，或先去记账页记一笔。</p>
            )}
          </section>
        </div>

        <CalendarLedger
          calendar={dashboard.calendar}
          selectedDate={selectedDate}
          dayEntries={dayEntries}
          monthKey={monthKey}
          onSelectDate={onSelectDate}
          onMonthChange={onMonthChange}
          resizeHandlers={resizeHandlers}
        />
      </div>
    </div>
  );
}
