import { Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import {
  TravelHistoryDetailModal,
  TravelHistoryPanel,
  TravelMergeModal,
  buildMergeDefaults,
} from "../TravelHistoryUI";
import type {
  PendingTravelHistoryDelete,
  TravelHistoryRecord,
  TravelState,
} from "../travelMode";

type ExchangeCache = {
  base: "USD";
  rates: Record<string, number>;
  updatedAt: number;
  source: string;
};

type TravelPageProps = {
  travelState: TravelState;
  travelHistory: TravelHistoryRecord[];
  travelHistoryRailOpen: boolean;
  travelHistoryMergeMode: boolean;
  travelHistorySelectedIds: string[];
  travelHistoryEditingId: string | null;
  travelHistoryEditingName: string;
  travelDraftBillName: string;
  travelDraftStartDate: string;
  travelDraftUseEndDate: boolean;
  travelDraftEndDate: string;
  travelStatus: string;
  travelRangeLabel: string;
  travelDetails: Array<{ date: string; category: string; amount: string; currency: string; note: string; travelKey: string }>;
  travelTotals: { converted: Record<string, number> };
  travelCategorySummary: Array<{ category: string; value: number; percent: number; color: string }>;
  travelSplitSummary: Array<{ participantId: string; name: string; owed: number }>;
  travelLocationOptions: string[];
  travelBudgetProgress: {
    dayCount: number;
    dailyBudget: number | null;
    total: number;
    dailyPercent: number;
    categoryProgress: Array<{ category: string; limit: number; spent: number; percent: number }>;
  };
  pendingTravelDeletes: PendingTravelHistoryDelete[];
  deleteToastTick: number;
  selectedTravelHistoryId: string | null;
  travelMergeModalOpen: boolean;
  allCurrencies: string[];
  exchange: ExchangeCache;
  modalRootRef: React.RefObject<HTMLDivElement | null>;
  formatMoney: (amount: number, currency: string) => string;
  parseAmount: (value: string) => number;
  convert: (amount: number, from: string, to: string, exchange: ExchangeCache) => number;
  getCurrencyMeta: (currency: string) => { name: string; shortName: string };
  buildFallbackBillName: (currency: string) => string;
  PieChart: ComponentType<{ summary: Array<{ category: string; value: number; percent: number; color: string }>; title: string }>;
  onEnableTravel: () => void;
  onEndTravel: () => void;
  onExportBill: () => void;
  onTravelNaturalSubmit: (rawInput: string) => void;
  setTravelDraftBillName: (value: string) => void;
  setTravelDraftStartDate: (value: string) => void;
  setTravelDraftUseEndDate: (value: boolean) => void;
  setTravelDraftEndDate: (value: string) => void;
  setTravelState: React.Dispatch<React.SetStateAction<TravelState>>;
  updateTravelParticipants: (names: string[]) => void;
  updateTravelEntryMeta: (travelKey: string, patch: Partial<{ participantIds: string[]; locationLabel: string }>) => void;
  updateTravelBudget: (patch: Partial<TravelState["budget"]>) => void;
  switchDailyDefaultCurrency: (currency: string) => void;
  setTravelHistoryRailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedTravelHistoryId: (id: string | null) => void;
  setTravelHistoryMergeMode: React.Dispatch<React.SetStateAction<boolean>>;
  setTravelHistorySelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  setTravelMergeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setTravelHistoryEditingId: (id: string | null) => void;
  setTravelHistoryEditingName: (name: string) => void;
  saveTravelHistoryRename: () => void;
  deleteTravelHistoryRecord: (id: string) => void;
  syncTravelHistoryRecord: (id: string, mode: "full" | "split") => void;
  undoTravelHistoryDelete: (id: string) => void;
  confirmTravelHistoryMerge: (payload: { name: string; startDate: string; endDate: string }) => void;
  closeTravelHistoryModal: () => void;
  PENDING_DELETE_TTL_MS: number;
};

export function TravelPage(props: TravelPageProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [travelQuickInput, setTravelQuickInput] = useState("");
  const {
    travelState,
    travelHistory,
    PieChart,
  } = props;

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { clearProps: "opacity,visibility,transform" });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 24 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "transform,opacity,visibility" },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  const selectedTravelHistory = travelHistory.find((item) => item.id === props.selectedTravelHistoryId) ?? null;
  const selectedMergeRecords = travelHistory.filter((record) => props.travelHistorySelectedIds.includes(record.id));
  const mergeDefaults = selectedMergeRecords.length ? buildMergeDefaults(selectedMergeRecords) : null;

  return (
    <main className="app-shell app-shell--below-nav travel-page" ref={pageRef} data-section="travel-page">
      <section className="travel-hero" data-section="travel-hero">
        <p className="eyebrow">Travel Mode</p>
        <h1>{travelState.active && travelState.billName ? travelState.billName : "旅游模式"}</h1>
        <p className="muted">{props.travelRangeLabel}</p>
      </section>

      <div className="travel-mode-zone" data-section="travel-mode">
        <section className="card travel-card">
          <div className="card-heading">
            <div>
              {travelState.active && travelState.locationLabel && (
                <p className="muted">定位参考：{travelState.locationLabel}</p>
              )}
            </div>
            <div className="travel-header-actions">
              {travelHistory.length > 0 && (
                <button
                  type="button"
                  className="travel-history-toggle"
                  data-action="toggle-travel-history"
                  onClick={() => props.setTravelHistoryRailOpen((open) => !open)}
                  aria-expanded={props.travelHistoryRailOpen}
                >
                  <span>{props.travelHistoryRailOpen ? "关闭历史" : "旅游历史"}</span>
                  <em>{travelHistory.length}</em>
                </button>
              )}
              <button type="button" data-action={travelState.active ? "travel-end" : "travel-start"} onClick={travelState.active ? props.onEndTravel : props.onEnableTravel}>
                {travelState.active ? "结束旅游" : "开始旅游记账"}
              </button>
            </div>
          </div>

          {!travelState.active && (
            <div className="travel-setup-grid">
              <label>
                旅游账单名称
                <input
                  value={props.travelDraftBillName}
                  placeholder={props.buildFallbackBillName(travelState.destinationCurrency)}
                  onChange={(event) => props.setTravelDraftBillName(event.target.value)}
                />
              </label>
              <label>
                开始日期
                <input
                  type="date"
                  value={props.travelDraftStartDate}
                  onChange={(event) => props.setTravelDraftStartDate(event.target.value)}
                />
              </label>
              <label className="travel-end-date-toggle">
                <span>预设结束日期</span>
                <input
                  type="checkbox"
                  checked={props.travelDraftUseEndDate}
                  onChange={(event) => props.setTravelDraftUseEndDate(event.target.checked)}
                />
              </label>
              <label className={props.travelDraftUseEndDate ? "" : "is-disabled"}>
                结束日期
                <input
                  type="date"
                  value={props.travelDraftEndDate}
                  disabled={!props.travelDraftUseEndDate}
                  min={props.travelDraftStartDate}
                  onChange={(event) => props.setTravelDraftEndDate(event.target.value)}
                />
              </label>
            </div>
          )}

          <div className="travel-controls">
            <label>
              目的地默认货币
              <select
                value={travelState.destinationCurrency}
                onChange={(event) => {
                  const currency = event.target.value;
                  props.setTravelState((current) => ({ ...current, destinationCurrency: currency }));
                  if (travelState.active) props.switchDailyDefaultCurrency(currency);
                }}
              >
                {props.allCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency} · {props.getCurrencyMeta(currency).shortName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              账单换算目标货币
              <select
                value={travelState.targetCurrency}
                onChange={(event) =>
                  props.setTravelState((current) => ({ ...current, targetCurrency: event.target.value }))
                }
              >
                {props.allCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency} · {props.getCurrencyMeta(currency).shortName}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="secondary-button" data-action="travel-export-bill" onClick={props.onExportBill} disabled={!props.travelDetails.length}>
              导出旅游账单
            </button>
          </div>

          <div className="travel-phase4-grid">
            <section className="travel-subpanel">
              <div>
                <p className="eyebrow">Split</p>
                <h3>同行人与均分口径</h3>
                <p className="muted">每笔消费按勾选参与人均分；这里展示每人应承担金额，不追踪谁先垫付。</p>
              </div>
              <div className="travel-participant-list">
                {travelState.participants.map((participant, index) => (
                  <label key={participant.id}>
                    同行人 {index + 1}
                    <input
                      value={participant.name}
                      onChange={(event) => {
                        const names = travelState.participants.map((item) => item.name);
                        names[index] = event.target.value;
                        props.updateTravelParticipants(names);
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => props.updateTravelParticipants([...travelState.participants.map((item) => item.name), `同行人${travelState.participants.length + 1}`])}
                >
                  添加同行人
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={travelState.participants.length <= 1}
                  onClick={() => props.updateTravelParticipants(travelState.participants.slice(0, -1).map((item) => item.name))}
                >
                  移除末位
                </button>
              </div>
              <div className="travel-split-summary">
                {props.travelSplitSummary.map((item) => (
                  <div key={item.participantId}>
                    <span>{item.name}</span>
                    <strong>{props.formatMoney(item.owed, travelState.targetCurrency)}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="travel-subpanel">
              <div>
                <p className="eyebrow">Budget</p>
                <h3>旅行预算</h3>
                <p className="muted">按旅行目标货币 {travelState.targetCurrency} 计算，支持每日预算和分类预算预警。</p>
              </div>
              <div className="travel-budget-inputs">
                <label>
                  每日预算
                  <input
                    inputMode="decimal"
                    data-action="travel-budget-daily"
                    value={travelState.budget.dailyLimit ?? ""}
                    placeholder={`例如 500 ${travelState.targetCurrency}`}
                    onChange={(event) => props.updateTravelBudget({ dailyLimit: Number(event.target.value) > 0 ? Number(event.target.value) : null })}
                  />
                </label>
                {["餐饮", "交通", "购物", "旅行"].map((category) => (
                  <label key={category}>
                    {category}预算
                    <input
                      inputMode="decimal"
                      data-action="travel-budget-category"
                      value={travelState.budget.categoryLimits[category] ?? ""}
                      onChange={(event) => {
                        const nextLimits = { ...travelState.budget.categoryLimits };
                        const parsed = Number(event.target.value);
                        if (Number.isFinite(parsed) && parsed > 0) nextLimits[category] = parsed;
                        else delete nextLimits[category];
                        props.updateTravelBudget({ categoryLimits: nextLimits });
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="travel-budget-progress">
                {props.travelBudgetProgress.dailyBudget ? (
                  <div className={props.travelBudgetProgress.dailyPercent > 100 ? "is-over" : ""}>
                    <span>{props.travelBudgetProgress.dayCount} 天总预算</span>
                    <strong>
                      {props.formatMoney(props.travelBudgetProgress.total, travelState.targetCurrency)}
                      {" / "}
                      {props.formatMoney(props.travelBudgetProgress.dailyBudget, travelState.targetCurrency)}
                    </strong>
                    <small>{props.travelBudgetProgress.dailyPercent.toFixed(1)}%</small>
                  </div>
                ) : (
                  <p className="muted">设置每日预算后显示总进度。</p>
                )}
                {props.travelBudgetProgress.categoryProgress.map((item) => (
                  <div key={item.category} className={item.percent > 100 ? "is-over" : ""}>
                    <span>{item.category}</span>
                    <strong>
                      {props.formatMoney(item.spent, travelState.targetCurrency)}
                      {" / "}
                      {props.formatMoney(item.limit, travelState.targetCurrency)}
                    </strong>
                    <small>{item.percent.toFixed(1)}%</small>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {props.travelStatus && <p className="status travel-status-banner">{props.travelStatus}</p>}

          {travelState.active && (
            <div className="travel-bill">
              <form
                className="travel-natural-entry"
                data-action="travel-natural-submit"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!travelQuickInput.trim()) return;
                  props.onTravelNaturalSubmit(travelQuickInput);
                  setTravelQuickInput("");
                }}
              >
                <div>
                  <p className="eyebrow">AA Quick Entry</p>
                  <h3>整单自然语言分账</h3>
                  <p className="muted">建议输入整单信息完成记账，例如：和 AB 在 XXX 餐厅吃饭，花了 300Jpy</p>
                </div>
                <label>
                  <span className="sr-only">旅游自然语言记账</span>
                  <input
                    data-action="travel-natural-input"
                    value={travelQuickInput}
                    onChange={(event) => setTravelQuickInput(event.target.value)}
                    placeholder="和 AB 在 XXX 餐厅吃饭，花了 300Jpy"
                  />
                </label>
                <button type="submit" data-action="travel-natural-confirm">写入并分摊</button>
              </form>
              <div className="totals-grid">
                <div>
                  <span>旅游总额 · {travelState.targetCurrency}</span>
                  <strong>
                    {props.formatMoney(
                      props.travelTotals.converted[travelState.targetCurrency] ?? 0,
                      travelState.targetCurrency,
                    )}
                  </strong>
                </div>
                <div>
                  <span>有效明细</span>
                  <strong>{props.travelDetails.length} 条</strong>
                </div>
              </div>
              <div className="chart-row">
                <Suspense fallback={<div className="chart-fallback">旅游图表载入中…</div>}>
                  <PieChart summary={props.travelCategorySummary} title="旅游账单" />
                </Suspense>
                <div className="summary-list">
                  {props.travelCategorySummary.length ? (
                    props.travelCategorySummary.map((item) => (
                      <div key={item.category}>
                        <span>{item.category}</span>
                        <strong>
                          {props.formatMoney(item.value, travelState.targetCurrency)} · {item.percent.toFixed(1)}%
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="muted">当前范围还没有旅游账单数据。</p>
                  )}
                </div>
              </div>
              <div className="travel-details">
                {props.travelDetails.slice(0, 12).map((entry, index) => (
                  <div key={`${entry.date}-${entry.category}-${index}`}>
                    <span>
                      {entry.date} · {entry.category}
                    </span>
                    <strong>
                      {props.formatMoney(
                        props.convert(
                          props.parseAmount(entry.amount),
                          entry.currency,
                          travelState.targetCurrency,
                          props.exchange,
                        ),
                        travelState.targetCurrency,
                      )}
                    </strong>
                    <small>
                      {entry.amount} {entry.currency}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </small>
                    <div className="travel-entry-meta">
                      <label>
                        地点标签
                        <input
                          list="travel-location-options"
                          data-action="travel-entry-location"
                          value={travelState.entryMeta[entry.travelKey]?.locationLabel ?? ""}
                          placeholder={travelState.locationLabel ?? "例如 东京站 / 机场"}
                          onChange={(event) => props.updateTravelEntryMeta(entry.travelKey, { locationLabel: event.target.value })}
                        />
                      </label>
                      <div className="travel-entry-participants" aria-label="参与分摊的人">
                        {travelState.participants.map((participant) => {
                          const selectedIds =
                            travelState.entryMeta[entry.travelKey]?.participantIds ??
                            travelState.participants.map((item) => item.id);
                          const checked = selectedIds.includes(participant.id);
                          return (
                            <label key={participant.id}>
                              <input
                                type="checkbox"
                                  data-action="travel-entry-participant"
                                checked={checked}
                                onChange={(event) => {
                                  const nextIds = event.target.checked
                                    ? [...selectedIds, participant.id]
                                    : selectedIds.filter((id) => id !== participant.id);
                                  props.updateTravelEntryMeta(entry.travelKey, {
                                    participantIds: nextIds.length ? nextIds : [participant.id],
                                  });
                                }}
                              />
                              {participant.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="travel-location-options">
                {props.travelLocationOptions.map((location) => (
                  <option key={location} value={location} />
                ))}
              </datalist>
            </div>
          )}
        </section>

        <TravelHistoryPanel
          records={travelHistory}
          open={props.travelHistoryRailOpen}
          mergeMode={props.travelHistoryMergeMode}
          selectedIds={props.travelHistorySelectedIds}
          editingId={props.travelHistoryEditingId}
          editingName={props.travelHistoryEditingName}
          onToggleOpen={() => props.setTravelHistoryRailOpen((open) => !open)}
          onSelectRecord={(id) => {
            props.setSelectedTravelHistoryId(id);
            props.setTravelHistoryRailOpen(false);
          }}
          onToggleMergeMode={() => {
            props.setTravelHistoryMergeMode((mode) => !mode);
            props.setTravelHistorySelectedIds([]);
            props.setTravelHistoryEditingId(null);
          }}
          onToggleSelected={(id) =>
            props.setTravelHistorySelectedIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          onStartMerge={() => props.setTravelMergeModalOpen(true)}
          onStartRename={(record) => {
            props.setTravelHistoryEditingId(record.id);
            props.setTravelHistoryEditingName(record.name);
          }}
          onEditingNameChange={props.setTravelHistoryEditingName}
          onSaveRename={props.saveTravelHistoryRename}
          onCancelRename={() => {
            props.setTravelHistoryEditingId(null);
            props.setTravelHistoryEditingName("");
          }}
          onDeleteRecord={props.deleteTravelHistoryRecord}
          formatMoney={props.formatMoney}
        />
      </div>

      {props.pendingTravelDeletes.length > 0 && (
        <div className="travel-delete-toast-stack" aria-live="polite">
          {props.pendingTravelDeletes.map((pending) => {
            const remainingMs = props.PENDING_DELETE_TTL_MS - (Date.now() - pending.deletedAt);
            const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
            void props.deleteToastTick;
            return (
              <aside key={pending.record.id} className="travel-delete-toast" role="status">
                <p>
                  「{pending.record.name}」已删除，{remainingSec} 秒内可恢复
                </p>
                <div className="travel-delete-toast-actions">
                  <button type="button" onClick={() => props.undoTravelHistoryDelete(pending.record.id)}>
                    撤销
                  </button>
                </div>
              </aside>
            );
          })}
        </div>
      )}

      {selectedTravelHistory && (
        <TravelHistoryDetailModal
          record={selectedTravelHistory}
          onClose={props.closeTravelHistoryModal}
          onSyncLocal={props.syncTravelHistoryRecord}
          formatMoney={props.formatMoney}
          modalRootRef={props.modalRootRef}
        />
      )}

      {props.travelMergeModalOpen && mergeDefaults && selectedMergeRecords.length >= 2 && (
        <TravelMergeModal
          records={selectedMergeRecords}
          defaultName={mergeDefaults.name}
          defaultStartDate={mergeDefaults.startDate}
          defaultEndDate={mergeDefaults.endDate}
          onConfirm={props.confirmTravelHistoryMerge}
          onClose={() => props.setTravelMergeModalOpen(false)}
          modalRootRef={props.modalRootRef}
        />
      )}
    </main>
  );
}
