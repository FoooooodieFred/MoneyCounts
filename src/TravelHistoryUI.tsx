import {
  FormEvent,
  KeyboardEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { TravelCurrencyBars, TravelPieChart, TravelStatCards } from "./travelCharts";
import type { TravelHistoryRecord } from "./travelMode";
import { getHistoryDateBounds, summarizeCurrencyDistribution } from "./travelMode";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type TravelHistoryPanelProps = {
  records: TravelHistoryRecord[];
  open: boolean;
  mergeMode: boolean;
  selectedIds: string[];
  editingId: string | null;
  editingName: string;
  onToggleOpen: () => void;
  onSelectRecord: (id: string) => void;
  onToggleMergeMode: () => void;
  onToggleSelected: (id: string) => void;
  onStartMerge: () => void;
  onStartRename: (record: TravelHistoryRecord) => void;
  onEditingNameChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDeleteRecord: (id: string) => void;
  formatMoney: (value: number, currency: string) => string;
};

export function TravelHistoryPanel({
  records,
  open,
  mergeMode,
  selectedIds,
  editingId,
  editingName,
  onToggleOpen,
  onSelectRecord,
  onToggleMergeMode,
  onToggleSelected,
  onStartMerge,
  onStartRename,
  onEditingNameChange,
  onSaveRename,
  onCancelRename,
  onDeleteRecord,
  formatMoney,
}: TravelHistoryPanelProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  const [mounted, setMounted] = useState(open);

  openRef.current = open;

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const shell = shellRef.current;
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    const list = listRef.current;
    if (!shell || !backdrop || !panel || !mounted) return;

    const reduceMotion = prefersReducedMotion();
    const listItems = list ? Array.from(list.children) : [];

    const ctx = gsap.context(() => {
      gsap.killTweensOf([backdrop, panel, listItems]);

      if (reduceMotion) {
        gsap.set(backdrop, {
          autoAlpha: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        });
        gsap.set(panel, {
          x: open ? 0 : 24,
          autoAlpha: open ? 1 : 0,
          scale: open ? 1 : 0.98,
          pointerEvents: open ? "auto" : "none",
        });
        if (listItems.length) {
          gsap.set(listItems, { x: 0, autoAlpha: open ? 1 : 0 });
        }
        if (!open) setMounted(false);
        return;
      }

      if (open) {
        gsap.set(backdrop, { pointerEvents: "auto" });
        gsap.set(panel, { pointerEvents: "auto" });

        const tl = gsap.timeline({ defaults: { overwrite: "auto" } });
        tl.fromTo(
          backdrop,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.32, ease: "power2.out" },
        )
          .fromTo(
            panel,
            { x: 36, autoAlpha: 0, scale: 0.94 },
            { x: 0, autoAlpha: 1, scale: 1, duration: 0.52, ease: "power3.out" },
            0,
          );

        if (listItems.length) {
          tl.fromTo(
            listItems,
            { x: 18, autoAlpha: 0 },
            {
              x: 0,
              autoAlpha: 1,
              duration: 0.38,
              stagger: 0.05,
              ease: "power2.out",
            },
            0.1,
          );
        }
      } else {
        gsap.set(backdrop, { autoAlpha: 1, pointerEvents: "auto" });
        gsap.set(panel, { x: 0, autoAlpha: 1, scale: 1, pointerEvents: "auto" });
        if (listItems.length) {
          gsap.set(listItems, { x: 0, autoAlpha: 1 });
        }

        const tl = gsap.timeline({
          defaults: { overwrite: "auto" },
          onComplete: () => {
            gsap.set([backdrop, panel, ...listItems], { clearProps: "transform,opacity,visibility" });
            setMounted(false);
          },
        });

        if (listItems.length) {
          tl.to(listItems, {
            x: 12,
            autoAlpha: 0,
            duration: 0.22,
            stagger: { each: 0.03, from: "end" },
            ease: "power2.in",
          });
        }

        tl.to(
          panel,
          {
            x: 28,
            autoAlpha: 0,
            scale: 0.96,
            duration: 0.34,
            ease: "power2.in",
            pointerEvents: "none",
          },
          listItems.length ? "-=0.08" : 0,
        ).to(
          backdrop,
          {
            autoAlpha: 0,
            duration: 0.28,
            ease: "power2.in",
            pointerEvents: "none",
          },
          "-=0.22",
        );
      }
    }, shell);

    return () => {
      if (!openRef.current) {
        gsap.killTweensOf([backdrop, panel, listItems]);
        return;
      }
      ctx.revert();
    };
  }, [open, mounted]);

  if (!records.length || !mounted) return null;

  return (
    <div
      className={`travel-history-shell${open || mounted ? " is-visible" : ""}`}
      ref={shellRef}
    >
      <div
        className="travel-history-backdrop"
        ref={backdropRef}
        aria-hidden="true"
        onClick={onToggleOpen}
      />
      <aside
        id="travel-history-panel"
        className="travel-history-rail"
        aria-label="旅游记账历史记录"
        ref={panelRef}
      >
        <div className="travel-history-rail-heading">
          <div className="travel-history-rail-title">
            <span className="travel-history-rail-eyebrow">Travel Archive</span>
            <strong className="travel-history-rail-title-main">旅游记账历史</strong>
            <small className="travel-history-rail-meta muted">{records.length} 次旅程</small>
          </div>
          <button
            type="button"
            className="ghost-button travel-history-close"
            onClick={onToggleOpen}
            aria-label="关闭记账历史"
          >
            ×
          </button>
        </div>

        <div className="travel-history-toolbar">
          <button
            type="button"
            className={mergeMode ? "secondary-button" : "ghost-button"}
            onClick={onToggleMergeMode}
          >
            {mergeMode ? "取消合并" : "合并记录"}
          </button>
          {mergeMode && (
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={onStartMerge}
            >
              合并 {selectedIds.length} 条
            </button>
          )}
        </div>

        <div className="travel-history-list" ref={listRef}>
          {records.map((record) => {
            const selected = selectedIds.includes(record.id);
            const editing = editingId === record.id;

            return (
              <div key={record.id} className={`travel-history-item-wrap${selected ? " is-selected" : ""}`}>
                {mergeMode && (
                  <label className="travel-history-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleSelected(record.id)}
                    />
                  </label>
                )}
                {editing ? (
                  <form
                    className="travel-history-edit"
                    onSubmit={(event: FormEvent) => {
                      event.preventDefault();
                      onSaveRename();
                    }}
                  >
                    <input
                      value={editingName}
                      onChange={(event) => onEditingNameChange(event.target.value)}
                      autoFocus
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Escape") onCancelRename();
                      }}
                    />
                    <div className="travel-history-edit-actions">
                      <button type="submit">保存</button>
                      <button type="button" className="ghost-button" onClick={onCancelRename}>
                        取消
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="travel-history-item"
                    onClick={() => (mergeMode ? onToggleSelected(record.id) : onSelectRecord(record.id))}
                  >
                    <strong>{record.name}</strong>
                    <small>{record.startDate} → {record.endDate}</small>
                    <span>{record.destinationCurrency} · {record.entryCount} 条</span>
                    <em>{formatMoney(record.totalAmount, record.targetCurrency)}</em>
                    {!mergeMode && (
                      <span className="travel-history-item-actions">
                        <span
                          className="travel-history-rename"
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            onStartRename(record);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              onStartRename(record);
                            }
                          }}
                        >
                          重命名
                        </span>
                        <span
                          className="travel-history-delete"
                          role="button"
                          tabIndex={0}
                          aria-label={`删除「${record.name}」`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteRecord(record.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              event.stopPropagation();
                              onDeleteRecord(record.id);
                            }
                          }}
                        >
                          删除
                        </span>
                      </span>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

type TravelHistoryDetailModalProps = {
  record: TravelHistoryRecord;
  onClose: () => void;
  formatMoney: (value: number, currency: string) => string;
  modalRootRef: RefObject<HTMLDivElement | null>;
};

export function TravelHistoryDetailModal({
  record,
  onClose,
  formatMoney,
  modalRootRef,
}: TravelHistoryDetailModalProps) {
  const categorySummary = useMemo(
    () =>
      record.categorySummary.map((item, index) => ({
        ...item,
        color: ["#89CFF0", "#A7D397", "#F4C2C2", "#FFDAB9", "#B4A7D6", "#C9E4DE"][index % 6],
      })),
    [record.categorySummary],
  );
  const currencyDistribution = useMemo(
    () => summarizeCurrencyDistribution(record.details, record.targetCurrency),
    [record.details, record.targetCurrency],
  );
  const dayCount = useMemo(
    () => new Set(record.details.map((entry) => entry.date)).size,
    [record.details],
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose} ref={modalRootRef}>
      <section
        className="modal-card travel-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-history-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Travel Archive</p>
            <h2 id="travel-history-modal-title">{record.name}</h2>
            <p className="muted">
              {record.startDate} 至 {record.endDate}
              {" · "}
              目的地 {record.destinationCurrency}
              {" · "}
              换算 {record.targetCurrency}
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} aria-label="关闭旅游记录">
            关闭
          </button>
        </div>

        <div className="travel-history-modal-details">
          <TravelStatCards
            cards={[
              {
                label: "旅游总额",
                value: formatMoney(record.totalAmount, record.targetCurrency),
                hint: record.targetCurrency,
                accent: "#356fd7",
              },
              {
                label: "有效明细",
                value: `${record.entryCount} 条`,
                hint: `${dayCount} 天有记录`,
                accent: "#4cb9ca",
              },
              {
                label: "货币种类",
                value: `${currencyDistribution.length} 种`,
                hint: currencyDistribution.map((item) => item.currency).join(" / ") || "—",
                accent: "#c4a35a",
              },
            ]}
          />

          <div className="travel-history-viz-grid">
            <div className="travel-history-viz-card">
              <h3>分类占比</h3>
              <div className="chart-row">
                <TravelPieChart summary={categorySummary} title={record.name} />
                <div className="legend">
                  {categorySummary.length ? (
                    categorySummary.map((item) => (
                      <div key={item.category} className="legend-item">
                        <span style={{ backgroundColor: item.color }} />
                        <b>{item.category}</b>
                        <em>{item.percent.toFixed(1)}%</em>
                      </div>
                    ))
                  ) : (
                    <p className="muted">该次旅游没有分类汇总数据。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="travel-history-viz-card">
              <h3>货币分布</h3>
              <TravelCurrencyBars
                items={currencyDistribution}
                targetCurrency={record.targetCurrency}
                formatMoney={formatMoney}
              />
            </div>
          </div>

          <div className="summary-list">
            {categorySummary.map((item) => (
              <div key={item.category}>
                <span>{item.category}</span>
                <strong>
                  {formatMoney(item.value, record.targetCurrency)} · {item.percent.toFixed(1)}%
                </strong>
              </div>
            ))}
          </div>

          <div className="travel-details">
            {record.details.length ? (
              record.details.map((entry, index) => (
                <div key={`${entry.date}-${entry.category}-${index}`}>
                  <span>{entry.date} · {entry.category}</span>
                  <strong>{formatMoney(entry.convertedAmount, record.targetCurrency)}</strong>
                  <small>
                    {entry.amount} {entry.currency}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </small>
                </div>
              ))
            ) : (
              <p className="muted">该次旅游没有明细记录。</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

type TravelMergeModalProps = {
  records: TravelHistoryRecord[];
  defaultName: string;
  defaultStartDate: string;
  defaultEndDate: string;
  onConfirm: (payload: { name: string; startDate: string; endDate: string }) => void;
  onClose: () => void;
  modalRootRef: RefObject<HTMLDivElement | null>;
};

export function TravelMergeModal({
  records,
  defaultName,
  defaultStartDate,
  defaultEndDate,
  onConfirm,
  onClose,
  modalRootRef,
}: TravelMergeModalProps) {
  const [name, setName] = useState(defaultName);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose} ref={modalRootRef}>
      <section
        className="modal-card travel-merge-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-merge-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Merge Archive</p>
            <h2 id="travel-merge-modal-title">合并 {records.length} 条旅游记录</h2>
            <p className="muted">合并后会生成一条新历史，并删除被选中的旧条目。</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            取消
          </button>
        </div>

        <div className="travel-merge-form">
          <label>
            合并后账单名称
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            开始日期
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            结束日期
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        <div className="travel-merge-preview">
          {records.map((record) => (
            <div key={record.id}>
              <strong>{record.name}</strong>
              <span>{record.startDate} → {record.endDate} · {record.entryCount} 条</span>
            </div>
          ))}
        </div>

        <label className="travel-merge-confirm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>我已了解：合并过程<strong>不可逆</strong>，被合并的旧条目将被永久删除。</span>
        </label>

        <div className="travel-merge-actions">
          <button
            type="button"
            className="danger-button"
            disabled={!confirmed || !name.trim() || !startDate || !endDate || startDate > endDate}
            onClick={() => onConfirm({ name: name.trim(), startDate, endDate })}
          >
            确认合并
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            返回
          </button>
        </div>
      </section>
    </div>
  );
}

export function buildMergeDefaults(records: TravelHistoryRecord[]) {
  const bounds = getHistoryDateBounds(records);
  return {
    name: records.length === 1 ? records[0].name : `${records[0]?.name ?? "合并"}等 ${records.length} 次旅程`,
    startDate: bounds.startDate,
    endDate: bounds.endDate,
  };
}
