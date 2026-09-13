import { useMemo, useState } from "react";
import { CalendarLedger } from "../components/CalendarLedger";
import { DailyFlowBarChart, CategoryDonut, NetWorthLineChart } from "../components/StatsCharts";
import { StatsCurrencyPicker } from "../components/StatsControls";
import { getRemainingDaysForBudget, shiftMonthKey } from "../lib/dateRange";
import { useResizableCalendar } from "../hooks/useResizableCalendar";
import {
  buildStatsDashboard,
  type DashboardFlow,
  type DashboardSourceEntry,
  type NetWorthSeries,
} from "../lib/statsDashboard";

type StatsDashboardPageProps = {
  monthKey: string;
  selectedDate: string;
  currency: string;
  currencies: string[];
  selectedCurrencies: string[];
  budgetEnabled: boolean;
  monthlyLimit: number | null;
  entries: DashboardSourceEntry[];
  dayEntries: Array<{
    category: string;
    amount: string;
    currency: string;
    note: string;
  }>;
  formatMoney: (amount: number, currency: string) => string;
  getCurrencyLabel: (currency: string) => string;
  onMonthChange: (monthKey: string) => void;
  onSelectDate: (date: string) => void;
  onToggleCurrency: (currency: string) => void;
};

export function StatsDashboardPage({
  monthKey,
  selectedDate,
  currency,
  currencies,
  selectedCurrencies,
  budgetEnabled,
  monthlyLimit,
  entries,
  dayEntries,
  formatMoney,
  getCurrencyLabel,
  onMonthChange,
  onSelectDate,
  onToggleCurrency,
}: StatsDashboardPageProps) {
  const [flow, setFlow] = useState<DashboardFlow>("expense");
  const [series, setSeries] = useState<NetWorthSeries>("netWorth");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const { boardRef, resizing, boardStyle, resizeHandlers } = useResizableCalendar();
  const remainingDays = getRemainingDaysForBudget(monthKey, selectedDate);
  const dashboard = useMemo(
    () =>
      buildStatsDashboard({
        monthKey,
        entries,
        budgetEnabled,
        monthlyLimit,
        remainingDays,
      }),
    [budgetEnabled, entries, monthKey, monthlyLimit, remainingDays],
  );

  const money = (value: number) => formatMoney(value, currency).replace(/\.00(?=\s)/, "");
  const signed = (value: number) =>
    `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
  const average =
    flow === "expense"
      ? dashboard.averageExpense
      : flow === "income"
        ? dashboard.averageIncome
        : dashboard.averageSurplus;

  return (
    <div
      className="app-shell app-shell--below-nav stats-dashboard-shell"
      data-section="stats-dashboard"
    >
      <div
        ref={boardRef}
        className={`stats-dashboard${resizing ? " is-resizing" : ""}`}
        style={boardStyle}
      >
        <div className="stats-dashboard__main">
          <header className="stats-dashboard__head">
            <div>
              <p className="eyebrow">Statistics</p>
              <h1>统计看板</h1>
              <p className="muted">多币种口径可切换。金额已换算为 {currency}。</p>
            </div>
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
              <button
                type="button"
                className="stats-card__currency-btn"
                data-action="stats-dashboard-currency"
                onClick={() => setCurrencyOpen(true)}
                aria-label="选择统计货币"
                title="选择统计货币"
              >
                💱
              </button>
            </div>
          </header>

          <section className="stats-kpi-grid" data-section="stats-kpi">
            <article className="stats-kpi-card">
              <span>总支出</span>
              <strong>{money(dashboard.kpi.expense)}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>剩余预算</span>
              <strong>
                {dashboard.kpi.budgetRemaining == null
                  ? "未开启"
                  : money(dashboard.kpi.budgetRemaining)}
              </strong>
            </article>
            <article className="stats-kpi-card">
              <span>待报销</span>
              <strong>{money(dashboard.kpi.pendingReimburse)}</strong>
            </article>
            <article className="stats-kpi-card">
              <span>净资产</span>
              <strong>{signed(dashboard.kpi.netWorth)}</strong>
            </article>
          </section>

          <div className="stats-dashboard__mid">
            <section className="stats-module-card" data-section="stats-bars">
              <header className="stats-module-card__head">
                <div>
                  <p className="eyebrow">Daily flow</p>
                  <h2>支出统计图</h2>
                </div>
                <div className="summary-mode-toggle" role="group" aria-label="柱状图口径">
                  {(
                    [
                      ["expense", "支出"],
                      ["income", "收入"],
                      ["surplus", "结余"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={flow === value ? "active" : undefined}
                      aria-pressed={flow === value}
                      onClick={() => setFlow(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </header>
              <DailyFlowBarChart
                rows={dashboard.dailyBars}
                flow={flow}
                average={average}
                formatValue={money}
              />
              <p className="muted">虚线为有记账日的平均值；高亮柱为当月极值。</p>
            </section>

            <section className="stats-module-card" data-section="stats-donut">
              <header className="stats-module-card__head">
                <div>
                  <p className="eyebrow">Categories</p>
                  <h2>支出分类详情</h2>
                </div>
              </header>
              <CategoryDonut
                rows={dashboard.categories}
                total={dashboard.kpi.expense}
                formatValue={money}
              />
              <ul className="stats-category-list">
                {dashboard.categories.length ? (
                  dashboard.categories.map((row) => (
                    <li key={row.category}>
                      <span>
                        {row.emoji} {row.category}
                      </span>
                      <em>{row.percent.toFixed(1)}%</em>
                      <strong>{money(row.amount)}</strong>
                      <small>{row.count} 笔</small>
                    </li>
                  ))
                ) : (
                  <li className="muted">本月还没有分类支出。</li>
                )}
              </ul>
            </section>
          </div>

          <section className="stats-module-card" data-section="stats-net">
            <header className="stats-module-card__head">
              <div>
                <p className="eyebrow">Net worth</p>
                <h2>净资产趋势图</h2>
              </div>
              <div className="summary-mode-toggle" role="group" aria-label="折线图口径">
                {(
                  [
                    ["netWorth", "净资产"],
                    ["assets", "总资产"],
                    ["liabilities", "总负债"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={series === value ? "active" : undefined}
                    aria-pressed={series === value}
                    onClick={() => setSeries(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <NetWorthLineChart rows={dashboard.netSeries} series={series} formatValue={money} />
          </section>
        </div>

        <CalendarLedger
          calendar={dashboard.calendar}
          selectedDate={selectedDate}
          dayEntries={dayEntries}
          onSelectDate={onSelectDate}
          resizeHandlers={resizeHandlers}
        />
      </div>

      <StatsCurrencyPicker
        open={currencyOpen}
        currencies={currencies}
        selected={selectedCurrencies}
        onToggle={onToggleCurrency}
        onClose={() => setCurrencyOpen(false)}
        getLabel={getCurrencyLabel}
      />
    </div>
  );
}
