import { ChangeEvent, DragEvent, KeyboardEvent, RefObject, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  TextField,
} from "@heroui/react";
import { ExchangeRatesPanel } from "../components/ExchangeRatesPanel";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import type { ExchangeRateRow } from "../components/ExchangeRatesPanel";
import {
  AppSettings,
  HOME_SECTION_LABELS,
  HomeSectionKey,
  HOME_SECTION_DEFAULT_ORDER,
  LOCKED_HOME_SECTIONS,
  PINNED_HOME_SECTIONS,
  TOGGLEABLE_HOME_SECTIONS,
  isToggleableHomeSection,
  normalizeHomeSectionOrder,
} from "../lib/appSettings";

export type BackupImportPreview = {
  fileName: string;
  exportedAt: string;
  incomingLedger: { dateCount: number; recordCount: number };
  currentLedger: { dateCount: number; recordCount: number };
  settingsWillOverwrite: boolean;
  travelHistoryCount: number;
  currentTravelHistoryCount: number;
};

type SettingsPageProps = {
  settings: AppSettings;
  categories: string[];
  currencies: string[];
  baseCurrency: string;
  exchangeSource: string;
  exchangeUpdatedAt: number;
  exchangeRows: ExchangeRateRow[];
  rateStatus: string;
  onRefreshExchange: () => void;
  backupReminderLabel: string;
  importMessage: string;
  importPreview: BackupImportPreview | null;
  jsonInputRef: RefObject<HTMLInputElement | null>;
  onSettingsChange: (settings: AppSettings) => void;
  getCurrencyLabel: (currency: string) => string;
  onExportJson: () => void;
  onPickJson: () => void;
  onJsonFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onConfirmJsonImport: () => void;
  onCancelJsonImport: () => void;
  onSnoozeBackupReminder: (days: number) => void;
};

const BUDGET_CURRENCY_FOLLOW = "__follow__";

const isLocked = (key: HomeSectionKey) =>
  LOCKED_HOME_SECTIONS.includes(key as (typeof LOCKED_HOME_SECTIONS)[number]);

const isToggleable = (key: HomeSectionKey) => isToggleableHomeSection(key);

const isPinned = (key: HomeSectionKey) =>
  PINNED_HOME_SECTIONS.includes(key as (typeof PINNED_HOME_SECTIONS)[number]);

export function SettingsPage({
  settings,
  categories,
  currencies,
  baseCurrency,
  exchangeSource,
  exchangeUpdatedAt,
  exchangeRows,
  rateStatus,
  onRefreshExchange,
  backupReminderLabel,
  importMessage,
  importPreview,
  jsonInputRef,
  onSettingsChange,
  getCurrencyLabel,
  onExportJson,
  onPickJson,
  onJsonFileChange,
  onConfirmJsonImport,
  onCancelJsonImport,
  onSnoozeBackupReminder,
}: SettingsPageProps) {
  const sectionOrder = normalizeHomeSectionOrder(settings.homeSectionOrder);
  const listRef = useRef<HTMLDivElement>(null);
  const [draggingKey, setDraggingKey] = useState<HomeSectionKey | null>(null);
  const [dragOverKey, setDragOverKey] = useState<HomeSectionKey | null>(null);

  const updateSection = (key: HomeSectionKey, checked: boolean) => {
    if (!isToggleable(key)) return;
    onSettingsChange({
      ...settings,
      homeSections: {
        ...settings.homeSections,
        [key]: checked,
      },
    });
  };

  const allToggleableVisible = TOGGLEABLE_HOME_SECTIONS.every((key) => settings.homeSections[key]);

  const toggleAllOptionalSections = () => {
    const nextVisible = !allToggleableVisible;
    onSettingsChange({
      ...settings,
      homeSections: {
        ...settings.homeSections,
        ...Object.fromEntries(TOGGLEABLE_HOME_SECTIONS.map((key) => [key, nextVisible])),
      },
    });
  };

  const animateReorder = (key: HomeSectionKey) => {
    if (prefersReducedMotion()) return;
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-home-section="${key}"]`);
      if (!el) return;
      gsap.fromTo(
        el,
        { scale: 0.985, boxShadow: "0 0 0 2px rgba(76, 185, 202, 0.42)" },
        {
          scale: 1,
          boxShadow: "0 0 0 0 rgba(76, 185, 202, 0)",
          duration: 0.42,
          ease: "power2.out",
        },
      );
    });
  };

  const updateSectionOrder = (nextOrder: HomeSectionKey[], movedKey?: HomeSectionKey) => {
    onSettingsChange({
      ...settings,
      homeSectionOrder: normalizeHomeSectionOrder(nextOrder),
    });
    if (movedKey) animateReorder(movedKey);
  };

  const moveSection = (key: HomeSectionKey, direction: -1 | 1) => {
    if (isPinned(key)) return;
    const currentIndex = sectionOrder.indexOf(key);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex <= 0 || targetIndex >= sectionOrder.length) return;
    const nextOrder = [...sectionOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];
    updateSectionOrder(nextOrder, key);
  };

  const handleSectionKeyDown = (event: KeyboardEvent<HTMLDivElement>, key: HomeSectionKey) => {
    if (isPinned(key)) return;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSection(key, -1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSection(key, 1);
    }
  };

  const handleDragStart = (event: DragEvent<HTMLSpanElement>, key: HomeSectionKey) => {
    if (isPinned(key)) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", key);
    setDraggingKey(key);
  };

  const handleDragEnd = () => {
    setDraggingKey(null);
    setDragOverKey(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetKey: HomeSectionKey) => {
    event.preventDefault();
    setDragOverKey(null);
    const sourceKey = event.dataTransfer.getData("text/plain") as HomeSectionKey;
    if (!sourceKey || sourceKey === targetKey || isPinned(sourceKey) || isPinned(targetKey)) return;
    const nextOrder = sectionOrder.filter((key) => key !== sourceKey);
    const targetIndex = nextOrder.indexOf(targetKey);
    if (targetIndex <= 0) return;
    nextOrder.splice(targetIndex, 0, sourceKey);
    updateSectionOrder(nextOrder, sourceKey);
  };

  const updateBudget = (patch: Partial<AppSettings["budget"]>) => {
    onSettingsChange({
      ...settings,
      budget: {
        ...settings.budget,
        ...patch,
      },
    });
  };

  const updateCategoryBudget = (category: string, value: string) => {
    const parsed = Number(value);
    const nextLimits = { ...settings.budget.categoryLimits };
    if (value.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
      delete nextLimits[category];
    } else {
      nextLimits[category] = parsed;
    }
    updateBudget({ categoryLimits: nextLimits });
  };

  const budgetCurrencyValue = settings.budget.currency ?? BUDGET_CURRENCY_FOLLOW;

  return (
    <main
      className="app-shell app-shell--below-nav settings-page-shell"
      data-section="settings-page"
    >
      <section className="settings-hero" data-section="settings-hero">
        <p className="eyebrow">Settings</p>
        <h1>设置与完整备份</h1>
        <p className="muted">
          调整首页可选卡片显隐，导出完整 JSON
          备份，或先预览再覆盖导入。仅趣味小卡片、工具与趋势、本周统计、本月汇总可隐藏；其余核心区块始终显示。
        </p>
      </section>

      <section className="settings-grid">
        <Card className="settings-panel">
          <Card.Header className="card-heading">
            <div>
              <p className="eyebrow">Home Layout</p>
              <Card.Title>首页区块显隐与排序</Card.Title>
              <Card.Description>
                仅 4 个可选区块可隐藏；核心记账路径始终显示。可拖动排序或使用 ↑↓ 调整顺序。
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="settings-bulk-actions">
              <Button
                variant="secondary"
                data-action="home-section-toggle-all"
                onPress={toggleAllOptionalSections}
              >
                {allToggleableVisible ? "一键隐藏可选区块" : "一键显示可选区块"}
              </Button>
            </div>
            <div
              ref={listRef}
              className="settings-toggle-list"
              data-section="home-section-order"
              role="list"
              aria-label="首页区块显隐与排序"
            >
              {sectionOrder.map((key) => {
                const locked = isLocked(key);
                const pinned = isPinned(key);
                const toggleable = isToggleable(key);
                return (
                  <div
                    key={key}
                    role="listitem"
                    data-home-section={key}
                    className={[
                      "settings-toggle",
                      locked ? "is-locked" : "",
                      pinned ? "is-pinned" : "",
                      draggingKey === key ? "is-dragging" : "",
                      dragOverKey === key && draggingKey !== key ? "is-drag-over" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    tabIndex={pinned ? -1 : 0}
                    aria-label={`${HOME_SECTION_LABELS[key]}${pinned ? "，固定第一位" : "，可拖动或使用方向键调整顺序"}`}
                    onKeyDown={(event) => handleSectionKeyDown(event, key)}
                    onDragOver={(event) => {
                      if (pinned || !draggingKey || draggingKey === key) return;
                      event.preventDefault();
                      setDragOverKey(key);
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === key) setDragOverKey(null);
                    }}
                    onDrop={(event) => handleDrop(event, key)}
                  >
                    <span
                      className="settings-toggle__drag-handle"
                      draggable={!pinned}
                      aria-hidden={pinned}
                      aria-label={pinned ? undefined : "拖动排序"}
                      onDragStart={(event) => handleDragStart(event, key)}
                      onDragEnd={handleDragEnd}
                    >
                      ⋮⋮
                    </span>
                    <span className="settings-toggle__copy">
                      <strong>{HOME_SECTION_LABELS[key]}</strong>
                      <small>
                        {pinned
                          ? "固定第一位，不可隐藏或移动"
                          : locked
                            ? "核心区块，始终显示，不可隐藏"
                            : toggleable && key === "heroCards"
                              ? "默认关闭；开启后第一屏显示趣味小卡片"
                              : toggleable
                                ? "可拖动 ⋮⋮ 排序，右侧开关控制显隐"
                                : "可拖动 ⋮⋮ 排序"}
                      </small>
                    </span>
                    <span className="settings-toggle__controls">
                      <Switch
                        isSelected={settings.homeSections[key]}
                        isDisabled={!toggleable}
                        aria-label={`${HOME_SECTION_LABELS[key]} 显示${!toggleable ? "（不可隐藏）" : ""}`}
                        onChange={(checked) => updateSection(key, checked)}
                      >
                        <Switch.Content>
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch.Content>
                      </Switch>
                    </span>
                  </div>
                );
              })}
            </div>
            <Button
              variant="secondary"
              data-action="home-section-reset-order"
              onPress={() => updateSectionOrder([...HOME_SECTION_DEFAULT_ORDER])}
            >
              恢复默认顺序
            </Button>
          </Card.Content>
        </Card>

        <Card className="settings-panel">
          <Card.Header className="card-heading">
            <div>
              <p className="eyebrow">Budget</p>
              <Card.Title>预算管理</Card.Title>
              <Card.Description>
                默认关闭；开启后首页显示月度总预算、分类预算和日均可花。
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="budget-settings-stack">
              <Switch
                isSelected={settings.budget.enabled}
                onChange={(checked) => updateBudget({ enabled: checked })}
              >
                <Switch.Content>
                  <span>
                    <strong>开启预算管理</strong>
                    <small>旧用户默认关闭，不会改动已有账本。</small>
                  </span>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
              <div className="budget-settings-grid">
                <Select
                  value={budgetCurrencyValue}
                  onChange={(key) => {
                    const next = String(key ?? BUDGET_CURRENCY_FOLLOW);
                    updateBudget({
                      currency: next === BUDGET_CURRENCY_FOLLOW ? null : next,
                    });
                  }}
                >
                  <Label>预算货币</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id={BUDGET_CURRENCY_FOLLOW} textValue="跟随当前统计/默认货币">
                        跟随当前统计/默认货币
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      {currencies.map((currency) => (
                        <ListBox.Item
                          key={currency}
                          id={currency}
                          textValue={`${currency} · ${getCurrencyLabel(currency)}`}
                        >
                          {currency} · {getCurrencyLabel(currency)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <TextField
                  value={settings.budget.monthlyLimit != null ? String(settings.budget.monthlyLimit) : ""}
                  onChange={(value) =>
                    updateBudget({
                      monthlyLimit: Number(value) > 0 ? Number(value) : null,
                    })
                  }
                >
                  <Label>月度总预算</Label>
                  <Input inputMode="decimal" placeholder="例如 6000" />
                </TextField>
              </div>
              <div className="category-budget-grid">
                {categories.map((category) => (
                  <TextField
                    key={category}
                    value={
                      settings.budget.categoryLimits[category] != null
                        ? String(settings.budget.categoryLimits[category])
                        : ""
                    }
                    onChange={(value) => updateCategoryBudget(category, value)}
                  >
                    <Label>{category}</Label>
                    <Input inputMode="decimal" placeholder="分类预算" />
                  </TextField>
                ))}
              </div>
            </div>
          </Card.Content>
        </Card>

        <Card className="settings-panel">
          <Card.Header className="card-heading">
            <div>
              <p className="eyebrow">Backup</p>
              <Card.Title>完整 JSON 备份</Card.Title>
              <Card.Description>
                包含账本、汇率缓存、货币设置、主题、提醒状态、设置页配置与旅游历史。
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="backup-action-stack">
              <Button data-action="json-backup-export" onPress={onExportJson}>
                立即导出 JSON
              </Button>
              <Button
                variant="secondary"
                data-action="json-backup-pick-import"
                onPress={onPickJson}
              >
                选择 JSON 导入
              </Button>
              <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={onJsonFileChange}
              />
              <p className="muted">当前提醒状态：{backupReminderLabel}</p>
              <div className="action-row">
                <Button variant="ghost" onPress={() => onSnoozeBackupReminder(1)}>
                  明天提醒
                </Button>
                <Button variant="secondary" onPress={() => onSnoozeBackupReminder(3)}>
                  3 天内不提醒
                </Button>
              </div>
            </div>
            {importMessage ? (
              <Alert status="accent" className="status">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{importMessage}</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </Card.Content>
        </Card>
      </section>

      <section className="settings-grid settings-grid--single">
        <Card className="settings-panel">
          <Card.Content>
            <ExchangeRatesPanel
              baseCurrency={baseCurrency}
              source={exchangeSource}
              updatedAt={exchangeUpdatedAt}
              rows={exchangeRows}
              rateStatus={rateStatus}
              onRefresh={onRefreshExchange}
              getCurrencyName={getCurrencyLabel}
              className="rate-section-bottom rate-section-bottom--settings"
              id="settings-rates"
            />
          </Card.Content>
        </Card>
      </section>

      {importPreview ? (
        <Card className="settings-panel import-preview" aria-live="polite">
          <Card.Header>
            <div>
              <p className="eyebrow">Import Preview</p>
              <Card.Title>导入前预览</Card.Title>
              <Card.Description>
                文件：{importPreview.fileName} · 导出时间：
                {new Date(importPreview.exportedAt).toLocaleString("zh-CN")}
              </Card.Description>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="import-preview-grid">
              <div>
                <span>将导入账本</span>
                <strong>
                  {importPreview.incomingLedger.dateCount} 天 /{" "}
                  {importPreview.incomingLedger.recordCount} 条
                </strong>
              </div>
              <div>
                <span>当前账本</span>
                <strong>
                  {importPreview.currentLedger.dateCount} 天 /{" "}
                  {importPreview.currentLedger.recordCount} 条
                </strong>
              </div>
              <div>
                <span>设置覆盖</span>
                <strong>{importPreview.settingsWillOverwrite ? "会覆盖" : "无设置项"}</strong>
              </div>
              <div>
                <span>旅游历史</span>
                <strong>
                  {importPreview.travelHistoryCount} 条（当前{" "}
                  {importPreview.currentTravelHistoryCount} 条）
                </strong>
              </div>
            </div>
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>
                  第一版导入采用“覆盖当前数据”模式。确认后会用备份文件替换当前账本、设置、旅游状态与相关本地缓存。
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <div className="action-row">
              <Button
                variant="danger"
                data-action="json-backup-confirm-import"
                onPress={onConfirmJsonImport}
              >
                确认覆盖导入
              </Button>
              <Button variant="secondary" onPress={onCancelJsonImport}>
                取消
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : null}
    </main>
  );
}
