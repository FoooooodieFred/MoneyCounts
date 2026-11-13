import { type FormEvent, useMemo, useState } from "react";

export type SearchableLedgerRecord = {
  date: string;
  category: string;
  amount: number;
  currency: string;
  note: string;
  convertedAmount: number;
};

type SearchPageProps = {
  getRecords: () => SearchableLedgerRecord[];
  categories: string[];
  currency: string;
  formatMoney: (value: number, currency: string) => string;
  onSelectDate: (date: string) => void;
};

export function SearchPage({
  getRecords,
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
  const [filteredRecords, setFilteredRecords] = useState<SearchableLedgerRecord[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [validationMessage, setValidationMessage] = useState("");

  const runSearch = (event: FormEvent) => {
    event.preventDefault();
    const text = keyword.trim().toLowerCase();
    const min = minAmount.trim() ? Number(minAmount) : null;
    const max = maxAmount.trim() ? Number(maxAmount) : null;
    if (
      (startDate && endDate && startDate > endDate) ||
      (min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0)) ||
      (min !== null && max !== null && min > max)
    ) {
      setValidationMessage("请检查日期先后与金额范围，金额需为非负数字。");
      return;
    }
    setValidationMessage("");
    setVisibleCount(50);

    setFilteredRecords(
      getRecords().filter((record) => {
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
        return (
          matchesText && matchesCategory && matchesStart && matchesEnd && matchesMin && matchesMax
        );
      }),
    );
  };

  const total = useMemo(
    () => filteredRecords?.reduce((sum, record) => sum + record.convertedAmount, 0) ?? 0,
    [filteredRecords],
  );

  return (
    <main className="app-shell app-shell--below-nav search-page-shell" data-section="search-page">
      <div className="content-rail search-stack">
        <header className="page-intro" data-section="search-hero">
          <h1>搜索与高级筛选</h1>
          <p className="muted">
            按备注、分类、金额和日期组合筛选。当前账本暂无标签字段，可用备注关键词作为标签搜索，例如输入「咖啡」或「#通勤」。
          </p>
        </header>

        <form
          className="surface-secondary search-filter-card"
          data-section="search-filters"
          onSubmit={runSearch}
        >
          <div className="search-filter-grid">
            <label>
              关键词
              <input
                data-action="search-keyword"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="备注 / 分类 / 金额"
              />
            </label>
            <label>
              分类
              <select
                data-action="search-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="全部">全部分类</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              开始日期
              <input
                type="date"
                data-action="search-start-date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <label>
              结束日期
              <input
                type="date"
                data-action="search-end-date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>
            <label>
              最小金额（{currency}）
              <input
                inputMode="decimal"
                data-action="search-min-amount"
                value={minAmount}
                onChange={(event) => setMinAmount(event.target.value)}
                placeholder="0"
              />
            </label>
            <label>
              最大金额（{currency}）
              <input
                inputMode="decimal"
                data-action="search-max-amount"
                value={maxAmount}
                onChange={(event) => setMaxAmount(event.target.value)}
                placeholder="不限"
              />
            </label>
          </div>
          <div className="action-row">
            <button type="submit" data-action="run-search">
              搜索
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setKeyword("");
                setCategory("全部");
                setStartDate("");
                setEndDate("");
                setMinAmount("");
                setMaxAmount("");
                setFilteredRecords(null);
                setVisibleCount(50);
                setValidationMessage("");
              }}
            >
              重置
            </button>
          </div>
          {validationMessage ? (
            <p className="nl-error" role="alert">
              {validationMessage}
            </p>
          ) : null}
          {filteredRecords !== null ? (
            <div className="search-filter-summary">
              <span>命中 {filteredRecords.length} 条</span>
              <strong>合计 {formatMoney(total, currency)}</strong>
            </div>
          ) : null}
        </form>

        <section className="search-result-list" data-section="search-results" aria-live="polite">
          {filteredRecords === null ? (
            <article className="surface-secondary search-result-empty">
              <h2>按需查询账本</h2>
              <p className="muted">设置筛选条件后点击「搜索」加载明细；不填条件可查询全部记录。</p>
            </article>
          ) : filteredRecords.length ? (
            filteredRecords.slice(0, visibleCount).map((record, index) => (
              <article
                key={`${record.date}-${record.category}-${index}`}
                className="surface-secondary search-result-item"
              >
                <div>
                  <span>{record.date}</span>
                  <strong>{record.category}</strong>
                  <small>{record.note || "无备注"}</small>
                </div>
                <div>
                  <strong>{formatMoney(record.amount, record.currency)}</strong>
                  <small>
                    {record.currency === currency
                      ? "当前口径"
                      : `≈ ${formatMoney(record.convertedAmount, currency)}`}
                  </small>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  data-action="search-select-date"
                  onClick={() => onSelectDate(record.date)}
                >
                  定位日期
                </button>
              </article>
            ))
          ) : (
            <article className="surface-secondary search-result-empty">
              <h2>没有找到匹配记录</h2>
              <p className="muted">试着放宽日期、金额区间，或用备注里的关键词继续搜索。</p>
            </article>
          )}
          {filteredRecords && visibleCount < filteredRecords.length ? (
            <button
              type="button"
              className="secondary-button"
              data-action="search-load-more"
              onClick={() => setVisibleCount((count) => count + 50)}
            >
              加载更多（已显示 {Math.min(visibleCount, filteredRecords.length)} /{" "}
              {filteredRecords.length} 条）
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
