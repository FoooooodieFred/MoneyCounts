import { CategoryDonut } from "./StatsCharts";
import { categoryEmoji } from "../lib/categoryIcons";
import type { MoneyMoreCard } from "../lib/moneyMoreCards";

type MoneyMoreStatCardsProps = {
  cards: MoneyMoreCard[];
  formatMoney: (amount: number, currency: string) => string;
};

export function MoneyMoreStatCards({ cards, formatMoney }: MoneyMoreStatCardsProps) {
  if (!cards.length) return null;
  return (
    <div className="mm-stat-stack">
      {cards.map((card, index) => {
        if (card.type === "kpi") {
          const money = (value: number) => formatMoney(value, card.currency);
          const signed = (value: number) =>
            `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
          return (
            <article key={`kpi-${card.month}-${index}`} className="mm-stat-card">
              <header>
                <p className="eyebrow">Month</p>
                <h3>{card.month} 统计</h3>
                <p className="muted">金额已换算为 {card.currency}</p>
              </header>
              <div className="mm-stat-card__kpi">
                <div>
                  <span>总支出</span>
                  <strong>{money(card.kpi.expense)}</strong>
                  <small>总收入 {money(card.kpi.income)}</small>
                </div>
                <div>
                  <span>剩余预算</span>
                  <strong>
                    {card.kpi.budgetRemaining == null ? "未开启" : money(card.kpi.budgetRemaining)}
                  </strong>
                  <small>
                    {card.kpi.budgetLimit == null
                      ? "可在设置打开月预算"
                      : `日均 ${money(card.kpi.dailyAvailable ?? 0)}`}
                  </small>
                </div>
                <div>
                  <span>待报销</span>
                  <strong>{money(card.kpi.pendingReimburse)}</strong>
                  <small>备注含待报销 / 未报销</small>
                </div>
                <div>
                  <span>净资产</span>
                  <strong>{signed(card.kpi.netWorth)}</strong>
                  <small>结余 {signed(card.kpi.surplus)}</small>
                </div>
              </div>
            </article>
          );
        }
        if (card.type === "categories") {
          const money = (value: number) => formatMoney(value, card.currency);
          const total = card.items.reduce((sum, item) => sum + item.amount, 0);
          return (
            <article key={`cat-${card.month}-${index}`} className="mm-stat-card">
              <header>
                <p className="eyebrow">Categories</p>
                <h3>支出分类</h3>
              </header>
              <div className="mm-stat-card__cats">
                <CategoryDonut rows={card.items} total={total} formatValue={money} />
                {card.items.length ? (
                  <ul className="mm-stat-card__list">
                    {card.items.slice(0, 8).map((item) => (
                      <li key={item.category}>
                        <span>
                          {item.emoji} {item.category}
                        </span>
                        <em>{item.percent.toFixed(0)}%</em>
                        <strong>{money(item.amount)}</strong>
                        <small>{item.count} 笔</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">这个月还没有分类支出。</p>
                )}
              </div>
            </article>
          );
        }
        if (card.type === "records") {
          return (
            <article key={`rec-${index}`} className="mm-stat-card">
              <header>
                <p className="eyebrow">Ledger</p>
                <h3>账单 {card.total} 笔</h3>
              </header>
              {card.items.length ? (
                <ul className="mm-stat-card__records">
                  {card.items.map((item, itemIndex) => (
                    <li key={`${item.date}-${itemIndex}`}>
                      <span>
                        {categoryEmoji(item.category)} {item.date} · {item.category}
                        {item.note ? ` · ${item.note}` : ""}
                      </span>
                      <strong>{formatMoney(item.amount, item.currency)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">没有匹配的账单。</p>
              )}
            </article>
          );
        }
        return (
          <article key={`calc-${index}`} className="mm-stat-card mm-stat-card--calc">
            <header>
              <p className="eyebrow">Calculator</p>
              <h3>计算结果</h3>
            </header>
            <p className="mm-stat-card__expr">
              <code>{card.expression}</code>
            </p>
            <strong className="mm-stat-card__value">{String(card.value)}</strong>
          </article>
        );
      })}
    </div>
  );
}
