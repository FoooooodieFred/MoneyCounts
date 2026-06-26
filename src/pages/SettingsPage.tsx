import { ChangeEvent, DragEvent, KeyboardEvent, RefObject, useRef, useState } from "react";
import { gsap } from "gsap";
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
  isMigratedHomeSection,
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
        { scale: 1, boxShadow: "0 0 0 0 rgba(76, 185, 202, 0)", duration: 0.42, ease: "power2.out" },
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
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]];
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

  return (
    <main className="app-shell app-shell--below-nav settings-page-shell" data-section="settings-page">
      <section className="settings-hero" data-section="settings-hero">
        <p className="eyebrow">Settings</p>
        <h1>设置与完整备份</h1>
        <p className="muted">
          调整首页可选卡片显隐，导出完整 JSON 备份，或先预览再覆盖导入。仅趣味小卡片、工具与趋势、本周统计、本月汇总可隐藏；其余核心区块始终显示。
        </p>
      </section>

      <section className="settings-grid">
        <article className="settings-panel card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Home Layout</p>
              <h2>首页区块显隐与排序</h2>
              <p className="muted">仅 4 个可选区块可隐藏；核心记账路径始终显示。可拖动排序或使用 ↑↓ 调整顺序。</p>
            </div>
          </div>
          <div className="settings-bulk-actions">
            <button
              type="button"
              className="secondary-button"
              data-action="home-section-toggle-all"
              onClick={toggleAllOptionalSections}
            >
              {allToggleableVisible ? "一键隐藏可选区块" : "一键显示可选区块"}
            </button>
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
                  ].filter(Boolean).join(" ")}
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
                    <label className="settings-toggle-switch">
                      <input
                        type="checkbox"
                        checked={settings.homeSections[key]}
                        disabled={!toggleable}
                        aria-label={`${HOME_SECTION_LABELS[key]} 显示${!toggleable ? "（不可隐藏）" : ""}`}
                        onChange={(event) => updateSection(key, event.target.checked)}
                      />
                      <span className="settings-toggle-switch__track" aria-hidden="true" />
                    </label>
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="secondary-button"
            data-action="home-section-reset-order"
            onClick={() => updateSectionOrder([...HOME_SECTION_DEFAULT_ORDER])}
          >
            恢复默认顺序
          </button>
        </article>

        <article className="settings-panel card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Budget</p>
              <h2>预算管理</h2>
              <p className="muted">默认关闭；开启后首页显示月度总预算、分类预算和日均可花。</p>
            </div>
          </div>
          <div className="budget-settings-stack">
            <label className="settings-toggle">
              <span>
                <strong>开启预算管理</strong>
                <small>旧用户默认关闭，不会改动已有账本。</small>
              </span>
              <input
                type="checkbox"
                checked={settings.budget.enabled}
                onChange={(event) => updateBudget({ enabled: event.target.checked })}
              />
            </label>
            <div className="budget-settings-grid">
              <label>
                预算货币
                <select
                  value={settings.budget.currency ?? ""}
                  onChange={(event) => updateBudget({ currency: event.target.value || null })}
                >
                  <option value="">跟随当前统计/默认货币</option>
                  {currencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency} · {getCurrencyLabel(currency)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                月度总预算
                <input
                  inputMode="decimal"
                  value={settings.budget.monthlyLimit ?? ""}
                  placeholder="例如 6000"
                  onChange={(event) => updateBudget({ monthlyLimit: Number(event.target.value) > 0 ? Number(event.target.value) : null })}
                />
              </label>
            </div>
            <div className="category-budget-grid">
              {categories.map((category) => (
                <label key={category}>
                  {category}
                  <input
                    inputMode="decimal"
                    value={settings.budget.categoryLimits[category] ?? ""}
                    placeholder="分类预算"
                    onChange={(event) => updateCategoryBudget(category, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        </article>

        <article className="settings-panel card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Backup</p>
              <h2>完整 JSON 备份</h2>
              <p className="muted">包含账本、汇率缓存、货币设置、主题、提醒状态、设置页配置与旅游历史。</p>
            </div>
          </div>
          <div className="backup-action-stack">
            <button type="button" data-action="json-backup-export" onClick={onExportJson}>
              立即导出 JSON
            </button>
            <button type="button" className="secondary-button" data-action="json-backup-pick-import" onClick={onPickJson}>
              选择 JSON 导入
            </button>
            <input ref={jsonInputRef} type="file" accept=".json,application/json" hidden onChange={onJsonFileChange} />
            <p className="muted">当前提醒状态：{backupReminderLabel}</p>
            <div className="action-row">
              <button type="button" className="ghost-button" onClick={() => onSnoozeBackupReminder(1)}>
                明天提醒
              </button>
              <button type="button" className="secondary-button" onClick={() => onSnoozeBackupReminder(3)}>
                3 天内不提醒
              </button>
            </div>
          </div>
          {importMessage ? <p className="status">{importMessage}</p> : null}
        </article>
      </section>

      <section className="settings-grid settings-grid--single">
        <article className="settings-panel card">
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
        </article>
      </section>

      {importPreview ? (
        <section className="settings-panel import-preview card-soft" aria-live="polite">
          <div>
            <p className="eyebrow">Import Preview</p>
            <h2>导入前预览</h2>
            <p className="muted">
              文件：{importPreview.fileName} · 导出时间：{new Date(importPreview.exportedAt).toLocaleString("zh-CN")}
            </p>
          </div>
          <div className="import-preview-grid">
            <div>
              <span>将导入账本</span>
              <strong>{importPreview.incomingLedger.dateCount} 天 / {importPreview.incomingLedger.recordCount} 条</strong>
            </div>
            <div>
              <span>当前账本</span>
              <strong>{importPreview.currentLedger.dateCount} 天 / {importPreview.currentLedger.recordCount} 条</strong>
            </div>
            <div>
              <span>设置覆盖</span>
              <strong>{importPreview.settingsWillOverwrite ? "会覆盖" : "无设置项"}</strong>
            </div>
            <div>
              <span>旅游历史</span>
              <strong>{importPreview.travelHistoryCount} 条（当前 {importPreview.currentTravelHistoryCount} 条）</strong>
            </div>
          </div>
          <p className="warning-text">
            第一版导入采用“覆盖当前数据”模式。确认后会用备份文件替换当前账本、设置、旅游状态与相关本地缓存。
          </p>
          <div className="action-row">
            <button type="button" className="danger-button" data-action="json-backup-confirm-import" onClick={onConfirmJsonImport}>
              确认覆盖导入
            </button>
            <button type="button" className="secondary-button" onClick={onCancelJsonImport}>
              取消
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
