import { Suspense, useEffect, useRef, useState, type ComponentType } from "react";
import { gsap } from "gsap";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextField,
} from "@heroui/react";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import {
  TravelHistoryDetailModal,
  TravelHistoryPanel,
  TravelMergeModal,
  buildMergeDefaults,
} from "../components/TravelHistoryUI";
import type {
  PendingTravelHistoryDelete,
  TravelHistoryRecord,
  TravelState,
} from "../lib/travelMode";

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
  travelDetails: Array<{
    date: string;
    category: string;
    amount: string;
    currency: string;
    note: string;
    travelKey: string;
  }>;
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
  PieChart: ComponentType<{
    summary: Array<{ category: string; value: number; percent: number; color: string }>;
    title: string;
  }>;
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
  updateTravelEntryMeta: (
    travelKey: string,
    patch: Partial<{ participantIds: string[]; locationLabel: string }>,
  ) => void;
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
  confirmTravelHistoryMerge: (payload: {
    name: string;
    startDate: string;
    endDate: string;
  }) => void;
  closeTravelHistoryModal: () => void;
  PENDING_DELETE_TTL_MS: number;
};

export function TravelPage(props: TravelPageProps) {
  const pageRef = useRef<HTMLElement | null>(null);
  const [travelQuickInput, setTravelQuickInput] = useState("");
  const { travelState, travelHistory, PieChart } = props;

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
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  const selectedTravelHistory =
    travelHistory.find((item) => item.id === props.selectedTravelHistoryId) ?? null;
  const selectedMergeRecords = travelHistory.filter((record) =>
    props.travelHistorySelectedIds.includes(record.id),
  );
  const mergeDefaults = selectedMergeRecords.length
    ? buildMergeDefaults(selectedMergeRecords)
    : null;

  return (
    <main
      className="app-shell app-shell--below-nav travel-page"
      ref={pageRef}
      data-section="travel-page"
    >
      <section className="travel-hero" data-section="travel-hero">
        <p className="eyebrow">Travel Mode</p>
        <h1>{travelState.active && travelState.billName ? travelState.billName : "旅游模式"}</h1>
        <p className="muted">{props.travelRangeLabel}</p>
      </section>

      <div className="travel-mode-zone" data-section="travel-mode">
        <Card className="travel-card">
          <Card.Header className="card-heading">
            <div>
              {travelState.active && travelState.locationLabel && (
                <p className="muted">定位参考：{travelState.locationLabel}</p>
              )}
            </div>
            <div className="travel-header-actions">
              {travelHistory.length > 0 && (
                <Button
                  variant="secondary"
                  className="travel-history-toggle"
                  data-action="toggle-travel-history"
                  onPress={() => props.setTravelHistoryRailOpen((open) => !open)}
                  aria-expanded={props.travelHistoryRailOpen}
                >
                  <span>{props.travelHistoryRailOpen ? "关闭历史" : "旅游历史"}</span>
                  <em>{travelHistory.length}</em>
                </Button>
              )}
              <Button
                data-action={travelState.active ? "travel-end" : "travel-start"}
                onPress={travelState.active ? props.onEndTravel : props.onEnableTravel}
              >
                {travelState.active ? "结束旅游" : "开始旅游记账"}
              </Button>
            </div>
          </Card.Header>

          <Card.Content>
            {!travelState.active && (
              <div className="travel-setup-grid">
                <TextField
                  value={props.travelDraftBillName}
                  onChange={props.setTravelDraftBillName}
                >
                  <Label>旅游账单名称</Label>
                  <Input
                    placeholder={props.buildFallbackBillName(travelState.destinationCurrency)}
                  />
                </TextField>
                <TextField
                  type="date"
                  value={props.travelDraftStartDate}
                  onChange={props.setTravelDraftStartDate}
                >
                  <Label>开始日期</Label>
                  <Input />
                </TextField>
                <Switch
                  className="travel-end-date-toggle"
                  isSelected={props.travelDraftUseEndDate}
                  onChange={props.setTravelDraftUseEndDate}
                >
                  <Switch.Content>
                    <span>预设结束日期</span>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
                <TextField
                  type="date"
                  className={props.travelDraftUseEndDate ? "" : "is-disabled"}
                  value={props.travelDraftEndDate}
                  isDisabled={!props.travelDraftUseEndDate}
                  onChange={props.setTravelDraftEndDate}
                >
                  <Label>结束日期</Label>
                  <Input min={props.travelDraftStartDate} />
                </TextField>
              </div>
            )}

            <div className="travel-controls">
              <Select
                value={travelState.destinationCurrency}
                onChange={(key) => {
                  const currency = String(key ?? travelState.destinationCurrency);
                  props.setTravelState((current) => ({
                    ...current,
                    destinationCurrency: currency,
                  }));
                  if (travelState.active) props.switchDailyDefaultCurrency(currency);
                }}
              >
                <Label>目的地默认货币</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {props.allCurrencies.map((currency) => (
                      <ListBox.Item
                        key={currency}
                        id={currency}
                        textValue={`${currency} · ${props.getCurrencyMeta(currency).shortName}`}
                      >
                        {currency} · {props.getCurrencyMeta(currency).shortName}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Select
                value={travelState.targetCurrency}
                onChange={(key) =>
                  props.setTravelState((current) => ({
                    ...current,
                    targetCurrency: String(key ?? current.targetCurrency),
                  }))
                }
              >
                <Label>账单换算目标货币</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {props.allCurrencies.map((currency) => (
                      <ListBox.Item
                        key={currency}
                        id={currency}
                        textValue={`${currency} · ${props.getCurrencyMeta(currency).shortName}`}
                      >
                        {currency} · {props.getCurrencyMeta(currency).shortName}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Button
                variant="secondary"
                data-action="travel-export-bill"
                onPress={props.onExportBill}
                isDisabled={!props.travelDetails.length}
              >
                导出旅游账单
              </Button>
            </div>

            <div className="travel-phase4-grid">
              <section className="travel-subpanel">
                <div>
                  <p className="eyebrow">Split</p>
                  <h3>同行人与均分口径</h3>
                  <p className="muted">
                    每笔消费按勾选参与人均分；这里展示每人应承担金额，不追踪谁先垫付。
                  </p>
                </div>
                <div className="travel-participant-list">
                  {travelState.participants.map((participant, index) => (
                    <TextField
                      key={participant.id}
                      value={participant.name}
                      onChange={(value) => {
                        const names = travelState.participants.map((item) => item.name);
                        names[index] = value;
                        props.updateTravelParticipants(names);
                      }}
                    >
                      <Label>同行人 {index + 1}</Label>
                      <Input />
                    </TextField>
                  ))}
                </div>
                <div className="action-row">
                  <Button
                    variant="secondary"
                    onPress={() =>
                      props.updateTravelParticipants([
                        ...travelState.participants.map((item) => item.name),
                        `同行人${travelState.participants.length + 1}`,
                      ])
                    }
                  >
                    添加同行人
                  </Button>
                  <Button
                    variant="ghost"
                    isDisabled={travelState.participants.length <= 1}
                    onPress={() =>
                      props.updateTravelParticipants(
                        travelState.participants.slice(0, -1).map((item) => item.name),
                      )
                    }
                  >
                    移除末位
                  </Button>
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
                  <p className="muted">
                    按旅行目标货币 {travelState.targetCurrency} 计算，支持每日预算和分类预算预警。
                  </p>
                </div>
                <div className="travel-budget-inputs">
                  <TextField
                    value={
                      travelState.budget.dailyLimit != null
                        ? String(travelState.budget.dailyLimit)
                        : ""
                    }
                    onChange={(value) =>
                      props.updateTravelBudget({
                        dailyLimit: Number(value) > 0 ? Number(value) : null,
                      })
                    }
                  >
                    <Label>每日预算</Label>
                    <Input
                      inputMode="decimal"
                      data-action="travel-budget-daily"
                      placeholder={`例如 500 ${travelState.targetCurrency}`}
                    />
                  </TextField>
                  {["餐饮", "交通", "购物", "旅行"].map((category) => (
                    <TextField
                      key={category}
                      value={
                        travelState.budget.categoryLimits[category] != null
                          ? String(travelState.budget.categoryLimits[category])
                          : ""
                      }
                      onChange={(value) => {
                        const nextLimits = { ...travelState.budget.categoryLimits };
                        const parsed = Number(value);
                        if (Number.isFinite(parsed) && parsed > 0) nextLimits[category] = parsed;
                        else delete nextLimits[category];
                        props.updateTravelBudget({ categoryLimits: nextLimits });
                      }}
                    >
                      <Label>{category}预算</Label>
                      <Input inputMode="decimal" data-action="travel-budget-category" />
                    </TextField>
                  ))}
                </div>
                <div className="travel-budget-progress">
                  {props.travelBudgetProgress.dailyBudget ? (
                    <div className={props.travelBudgetProgress.dailyPercent > 100 ? "is-over" : ""}>
                      <span>{props.travelBudgetProgress.dayCount} 天总预算</span>
                      <strong>
                        {props.formatMoney(
                          props.travelBudgetProgress.total,
                          travelState.targetCurrency,
                        )}
                        {" / "}
                        {props.formatMoney(
                          props.travelBudgetProgress.dailyBudget,
                          travelState.targetCurrency,
                        )}
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

            {props.travelStatus ? (
              <Alert status="accent" className="travel-status-banner">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{props.travelStatus}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

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
                    <p className="muted">
                      建议输入整单信息完成记账，例如：和 AB 在 XXX 餐厅吃饭，花了 300Jpy
                    </p>
                  </div>
                  <TextField value={travelQuickInput} onChange={setTravelQuickInput}>
                    <Label className="sr-only">旅游自然语言记账</Label>
                    <Input
                      data-action="travel-natural-input"
                      placeholder="和 AB 在 XXX 餐厅吃饭，花了 300Jpy"
                    />
                  </TextField>
                  <Button type="submit" data-action="travel-natural-confirm">
                    写入并分摊
                  </Button>
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
                            {props.formatMoney(item.value, travelState.targetCurrency)} ·{" "}
                            {item.percent.toFixed(1)}%
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
                        <TextField
                          value={travelState.entryMeta[entry.travelKey]?.locationLabel ?? ""}
                          onChange={(value) =>
                            props.updateTravelEntryMeta(entry.travelKey, {
                              locationLabel: value,
                            })
                          }
                        >
                          <Label>地点标签</Label>
                          <Input
                            list="travel-location-options"
                            data-action="travel-entry-location"
                            placeholder={travelState.locationLabel ?? "例如 东京站 / 机场"}
                          />
                        </TextField>
                        <div className="travel-entry-participants" aria-label="参与分摊的人">
                          {travelState.participants.map((participant) => {
                            const selectedIds =
                              travelState.entryMeta[entry.travelKey]?.participantIds ??
                              travelState.participants.map((item) => item.id);
                            const checked = selectedIds.includes(participant.id);
                            return (
                              <Checkbox
                                key={participant.id}
                                data-action="travel-entry-participant"
                                isSelected={checked}
                                onChange={(isSelected) => {
                                  const nextIds = isSelected
                                    ? [...selectedIds, participant.id]
                                    : selectedIds.filter((id) => id !== participant.id);
                                  props.updateTravelEntryMeta(entry.travelKey, {
                                    participantIds: nextIds.length ? nextIds : [participant.id],
                                  });
                                }}
                              >
                                <Checkbox.Content>
                                  <Checkbox.Control>
                                    <Checkbox.Indicator />
                                  </Checkbox.Control>
                                  {participant.name}
                                </Checkbox.Content>
                              </Checkbox>
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
          </Card.Content>
        </Card>

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
              <Alert key={pending.record.id} className="travel-delete-toast" status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>
                    「{pending.record.name}」已删除，{remainingSec} 秒内可恢复
                  </Alert.Description>
                </Alert.Content>
                <Button size="sm" onPress={() => props.undoTravelHistoryDelete(pending.record.id)}>
                  撤销
                </Button>
              </Alert>
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
