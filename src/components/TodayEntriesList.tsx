import { useRef } from "react";
import { gsap } from "gsap";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

type TodayEntry = {
  index: number;
  categoryIndex: number;
  category: string;
  rowIndex: number;
  amount: string;
  currency: string;
  note: string;
  hidden?: boolean;
};

type TodayEntriesListProps = {
  entries: TodayEntry[];
  currencies: string[];
  formatMoney: (amount: number, currency: string) => string;
  parseAmount: (value: string) => number;
  onAmountChange: (index: number, value: string) => void;
  onNoteChange: (index: number, value: string) => void;
  onCurrencyChange: (index: number, currency: string) => void;
  onDelete: (categoryIndex: number, rowIndex: number) => void;
};

export function TodayEntriesList({
  entries,
  currencies,
  formatMoney,
  parseAmount,
  onAmountChange,
  onNoteChange,
  onCurrencyChange,
  onDelete,
}: TodayEntriesListProps) {
  const tableRef = useRef<HTMLDivElement | null>(null);

  useGsapContext(tableRef, (ctx) => {
    if (prefersReducedMotion()) return;
    const onFocus = (event: Event) => {
      const cell = (event.target as HTMLElement).closest("td");
      if (!cell) return;
      gsap.to(cell, { scale: 1.01, duration: 0.2, ease: "power2.out", overwrite: "auto" });
    };
    const onBlur = (event: Event) => {
      const cell = (event.target as HTMLElement).closest("td");
      if (!cell) return;
      gsap.to(cell, { scale: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" });
    };
    ctx.selector?.(".today-inline-table input, .today-inline-table select")?.forEach((el: Element) => {
      el.addEventListener("focus", onFocus);
      el.addEventListener("blur", onBlur);
    });
    return () => {
      ctx.selector?.(".today-inline-table input, .today-inline-table select")?.forEach((el: Element) => {
        el.removeEventListener("focus", onFocus);
        el.removeEventListener("blur", onBlur);
      });
    };
  }, [entries.length]);

  if (!entries.length) {
    return <p className="muted empty-state">今天还没有记录，用上方对话框记第一笔吧。</p>;
  }

  return (
    <div ref={tableRef} className="today-inline-table-wrap" data-section="today-inline-ledger">
      <table className="today-inline-table">
        <thead>
          <tr>
            <th>分类</th>
            <th>金额</th>
            <th>货币</th>
            <th>备注</th>
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={`${entry.category}-${entry.rowIndex}-${entry.index}`} className={entry.hidden ? "is-hidden" : undefined}>
              <td>
                <span className="today-entry-list__category">{entry.category}</span>
              </td>
              <td>
                <input
                  inputMode="decimal"
                  data-action="today-inline-amount"
                  value={entry.amount}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (/^-?\d*\.?\d{0,2}$/.test(value) || value === "-" || value === "") {
                      onAmountChange(entry.index, value);
                    }
                  }}
                  aria-label={`${entry.category} 金额`}
                />
              </td>
              <td>
                <select
                  value={entry.currency}
                  data-action="today-inline-currency"
                  onChange={(event) => onCurrencyChange(entry.index, event.target.value)}
                  aria-label={`${entry.category} 货币`}
                >
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  value={entry.note}
                  data-action="today-inline-note"
                  onChange={(event) => onNoteChange(entry.index, event.target.value)}
                  placeholder="备注"
                  aria-label={`${entry.category} 备注`}
                />
              </td>
              <td className="today-inline-table__actions">
                <button
                  type="button"
                  className="delete-record-button"
                  data-action="today-inline-delete"
                  onClick={() => onDelete(entry.categoryIndex, entry.rowIndex)}
                  aria-label="删除"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} className="today-inline-table__summary">
              共 {entries.length} 笔 · 合计{" "}
              {Object.entries(
                entries.reduce<Record<string, number>>((acc, entry) => {
                  const amt = parseAmount(entry.amount);
                  if (amt === 0) return acc;
                  acc[entry.currency] = (acc[entry.currency] ?? 0) + amt;
                  return acc;
                }, {}),
              )
                .map(([currency, total]) => `${formatMoney(total, currency)} ${currency}`)
                .join(" · ") || "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
