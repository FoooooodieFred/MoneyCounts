import { useMemo, useState } from "react";

export type SearchableLedgerRecord = {
  date: string;
  category: string;
  amount: number;
  currency: string;
  note: string;
  convertedAmount: number;
};

type SearchPageProps = {
  records: SearchableLedgerRecord[];
  categories: string[];
  currency: string;
  formatMoney: (value: number, currency: string) => string;
  onSelectDate: (date: string) => void;
};

export function SearchPage({
  records,
  categories,
  currency,
  formatMoney,
  onSelectDate,
}: SearchPageProps) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("全部");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const filteredRecords = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;

    return records.filter((record) => {
      const amount = Math.abs(record.convertedAmount);
      const matchesText =
        !text ||
        record.note.toLowerCase().includes(text) ||
        record.category.toLowerCase().includes(text) ||
        String(Math.abs(record.amount)).includes(text);
      const matchesCategory = category === "全部" || record.category === category;
      const matchesStart = !startDate || record.date >= startDate;
      const matchesEnd = !endDate || record.date <= endDate;
      const matchesMin = min === null || (Number.isFinite(min) && amount >= min);
      const matchesMax = max === null || (Number.isFinite(max) && amount <= max);
      return matchesText && matchesCategory && matchesStart && matchesEnd && matchesMin && matchesMax;
    });
  }, [category, endDate, keyword, maxAmount, minAmount, records, startDate]);

  const total = filteredRecords.reduce((sum, record) => sum + record.convertedAmount, 0);

  return (
    <main className="app-shell app-shell--below-nav search-page-shell" data-section="search-page">
      <section className="search-hero" data-section="search-hero">
        <p className="eyebrow">Search</p>
        <h1>搜索与高级筛选</h1>
        <p className="muted">
          按备注、分类、金额和日期组合筛选。当前账本暂无标签字段，可用备注关键词作为标签搜索，例如输入「咖啡」或「#通勤」。
        </p>
      </section>

      <section className="card search-filter-card" data-section="search-filters">
        <div className="search-filter-grid">
          <label>
            关键词
            <input data-action="search-keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="备注 / 分类 / 金额" />
          </label>
          <label>
            分类
            <select data-action="search-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="全部">全部分类</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            开始日期
            <input type="date" data-action="search-start-date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            结束日期
            <input type="date" data-action="search-end-date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            最小金额（{currency}）
            <input inputMode="decimal" data-action="search-min-amount" value={minAmount} onChange={(event) => setMinAmount(event.target.value)} placeholder="0" />
          </label>
          <label>
            最大金额（{currency}）
            <input inputMode="decimal" data-action="search-max-amount" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder="不限" />
          </label>
        </div>
        <div className="search-filter-summary">
          <span>命中 {filteredRecords.length} 条</span>
          <strong>合计 {formatMoney(total, currency)}</strong>
        </div>
      </section>

      <section className="search-result-list" data-section="search-results">
        {filteredRecords.length ? (
          filteredRecords.map((record, index) => (
            <article key={`${record.date}-${record.category}-${index}`} className="card search-result-item">
              <div>
                <span>{record.date}</span>
                <strong>{record.category}</strong>
                <small>{record.note || "无备注"}</small>
              </div>
              <div>
                <strong>{formatMoney(record.amount, record.currency)}</strong>
                <small>{record.currency === currency ? "当前口径" : `≈ ${formatMoney(record.convertedAmount, currency)}`}</small>
              </div>
              <button type="button" className="secondary-button" data-action="search-select-date" onClick={() => onSelectDate(record.date)}>
                定位日期
              </button>
            </article>
          ))
        ) : (
          <article className="card search-result-empty">
            <h2>没有找到匹配记录</h2>
            <p className="muted">试着放宽日期、金额区间，或用备注里的关键词继续搜索。</p>
          </article>
        )}
      </section>
    </main>
  );
}
