import { Button, Card, ProgressBar } from "@heroui/react";
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
      <Card className="card budget-overview budget-overview--empty">
        <Card.Header className="card-heading">
          <div>
            <p className="eyebrow">Budget</p>
            <Card.Title>预算管理未开启</Card.Title>
            <Card.Description>
              可在设置页手动开启月度总预算和分类预算，旧数据会继续保持原样。
            </Card.Description>
          </div>
          <Button onPress={onOpenSettings}>去设置</Button>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card
      className={`card budget-overview${isOverMonthly ? " is-over" : ""}`}
      aria-label={`${monthKey} 预算概览`}
    >
      <Card.Header className="card-heading">
        <div>
          <p className="eyebrow">Budget · {currency}</p>
          <Card.Title>{monthKey} 预算概览</Card.Title>
          <Card.Description>负支出会抵扣消费；跨币种已按当前汇率换算。</Card.Description>
        </div>
        <Button variant="secondary" onPress={onOpenSettings}>
          调整预算
        </Button>
      </Card.Header>

      <Card.Content>
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
            <ProgressBar
              aria-label={`月预算使用 ${monthlyPercent.toFixed(0)}%`}
              className="budget-progress-track"
              color={isOverMonthly ? "danger" : "accent"}
              value={Math.min(100, monthlyPercent)}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
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
                <div
                  key={item.category}
                  className={over ? "budget-category is-over" : "budget-category"}
                >
                  <div className="budget-category__meta">
                    <strong>{item.category}</strong>
                    <span>
                      {formatMoney(item.spent, currency)} / {formatMoney(item.limit, currency)}
                    </span>
                  </div>
                  <ProgressBar
                    aria-label={`${item.category} 预算 ${percent.toFixed(0)}%`}
                    className="budget-progress-track budget-progress-track--mini"
                    color={over ? "danger" : "accent"}
                    size="sm"
                    value={Math.min(100, percent)}
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>
              );
            })
          ) : (
            <p className="muted">还没有设置分类预算；可以先只用月度总预算。</p>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}
