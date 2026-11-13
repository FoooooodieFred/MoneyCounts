import type { ReactNode } from "react";
import { SummaryModeToggle } from "../components/StatsControls";
import {
  LedgerCalendarLayout,
  type LedgerCalendarLayoutProps,
} from "../components/LedgerCalendarLayout";

type DaySummaryPageProps = LedgerCalendarLayoutProps & {
  weekdayLabel: string;
  summaryMode: "split" | "merged";
  splitCurrencies: string[];
  dayTotals: { native: Record<string, number>; converted: Record<string, number> };
  dailyDefaultCurrency: string;
  recordCount: number;
  formatMoney: (amount: number, currency: string) => string;
  getCurrencyLabel: (currency: string) => string;
  onSummaryModeChange: (mode: "split" | "merged") => void;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  children: ReactNode;
};

export function DaySummaryPage({
  selectedDate,
  weekdayLabel,
  summaryMode,
  splitCurrencies,
  dayTotals,
  dailyDefaultCurrency,
  recordCount,
  formatMoney,
  getCurrencyLabel,
  onSummaryModeChange,
  onPrevDay,
  onToday,
  onNextDay,
  children,
  monthKey,
  entries,
  dayEntries,
  onSelectDate,
  onMonthChange,
}: DaySummaryPageProps) {
  return (
    <div
      className="app-shell app-shell--below-nav stats-dashboard-shell day-summary-shell"
      data-section="screen-day"
    >
      <LedgerCalendarLayout
        monthKey={monthKey}
        selectedDate={selectedDate}
        entries={entries}
        dayEntries={dayEntries}
        onSelectDate={onSelectDate}
        onMonthChange={onMonthChange}
      >
        <header className="stats-dashboard__head page-intro">
          <div>
            <h1>今日</h1>
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
            <h2>分币种合计</h2>
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
              <strong>{recordCount}</strong>
            </article>
          </div>
        </section>
        {children}
      </LedgerCalendarLayout>
    </div>
  );
}
