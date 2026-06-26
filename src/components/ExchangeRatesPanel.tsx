export type ExchangeRateRow = {
  currency: string;
  value: number;
};

type ExchangeRatesPanelProps = {
  baseCurrency: string;
  source: string;
  updatedAt: number;
  rows: ExchangeRateRow[];
  rateStatus?: string;
  onRefresh: () => void;
  getCurrencyName: (currency: string) => string;
  className?: string;
  id?: string;
};

export function ExchangeRatesPanel({
  baseCurrency,
  source,
  updatedAt,
  rows,
  rateStatus,
  onRefresh,
  getCurrencyName,
  className = "rate-section-bottom card-soft",
  id = "rates",
}: ExchangeRatesPanelProps) {
  return (
    <section className={className} id={id} data-section="exchange-rates">
      <div className="rate-section-bottom__header">
        <div>
          <p className="eyebrow">Exchange</p>
          <h2>1 {baseCurrency} 的兑换汇率</h2>
          <p className="muted">
            {source} · {new Date(updatedAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <button type="button" data-action="exchange-refresh" onClick={onRefresh}>
          汇率刷新
        </button>
      </div>
      <div className="rate-table">
        {rows.map(({ currency, value }) => (
          <div key={currency}>
            <span>{currency}</span>
            <strong>{value.toFixed(value >= 100 ? 2 : 4)}</strong>
            <small>{getCurrencyName(currency)}</small>
          </div>
        ))}
      </div>
      {rateStatus ? <p className="status rate-section-bottom__status">{rateStatus}</p> : null}
      <p className="muted">NTD 在外部汇率接口中按 TWD 映射，界面统一展示为 NTD。</p>
    </section>
  );
}
