import type { BudgetSettings } from "../lib/appSettings";
import { calculateBudgetAvailability } from "../lib/ledgerStats";

type BudgetCategoryProgress = {
  category: string;
  limit: number;
  spent: number;
};

type BudgetOverviewProps = {
  settings: BudgetSettings;
  currency: string;
  monthKey: string;
  monthlySpent: number;
  categoryProgress: BudgetCategoryProgress[];
  remainingDays: number;
  formatMoney: (value: number, currency: string) => string;
  onOpenSettings: () => void;
};

export function BudgetOverview({
  settings,
  currency,
  monthKey,
  monthlySpent,
  categoryProgress,
  remainingDays,
  formatMoney,
  onOpenSettings,
}: BudgetOverviewProps) {
  const budget = calculateBudgetAvailability(settings.monthlyLimit, monthlySpent, remainingDays);
  const hasBudget = settings.enabled && budget.limit > 0;
  const monthlyPercent = budget.percent;
  const isOverMonthly = settings.enabled && budget.isOver;

  if (!settings.enabled) {
    return (
      <section className="card budget-overview budget-overview--empty">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Budget</p>
            <h2>预算管理未开启</h2>
            <p className="muted">可在设置页手动开启月度总预算和分类预算，旧数据会继续保持原样。</p>
          </div>
          <button type="button" onClick={onOpenSettings}>去设置</button>
        </div>
      </section>
    );
  }

  return (
    <section className={`card budget-overview${isOverMonthly ? " is-over" : ""}`} aria-label={`${monthKey} 预算概览`}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Budget · {currency}</p>
          <h2>{monthKey} 预算概览</h2>
          <p className="muted">负支出会抵扣消费；跨币种已按当前汇率换算。</p>
        </div>
        <button type="button" className="secondary-button" onClick={onOpenSettings}>调整预算</button>
      </div>

      {hasBudget ? (
        <>
          <div className="budget-hero-row">
            <div>
              <span>本月已用</span>
              <strong>{formatMoney(monthlySpent, currency)}</strong>
            </div>
            <div>
              <span>{isOverMonthly ? "已超出" : "剩余预算"}</span>
              <strong>{formatMoney(Math.abs(budget.remaining), currency)}</strong>
            </div>
            <div>
              <span>日均可花</span>
              <strong>{formatMoney(budget.dailyAvailable, currency)}</strong>
              <small>{remainingDays} 天可规划</small>
            </div>
          </div>
          <div className="budget-progress-track" aria-label={`月预算使用 ${monthlyPercent.toFixed(0)}%`}>
            <span style={{ width: `${Math.min(100, monthlyPercent)}%` }} />
          </div>
        </>
      ) : (
        <p className="muted">已开启预算管理，请在设置页填写月度总预算后展示进度。</p>
      )}

      <div className="budget-category-list">
        {categoryProgress.length ? (
          categoryProgress.map((item) => {
            const percent = calculateBudgetAvailability(item.limit, item.spent, 0).percent;
            const over = item.spent > item.limit;
            return (
              <div key={item.category} className={over ? "budget-category is-over" : "budget-category"}>
                <div className="budget-category__meta">
                  <strong>{item.category}</strong>
                  <span>{formatMoney(item.spent, currency)} / {formatMoney(item.limit, currency)}</span>
                </div>
                <div className="budget-progress-track budget-progress-track--mini">
                  <span style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <p className="muted">还没有设置分类预算；可以先只用月度总预算。</p>
        )}
      </div>
    </section>
  );
}
