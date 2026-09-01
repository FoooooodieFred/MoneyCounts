import { ChangeEvent, RefObject, useState } from "react";
import { Link } from "react-router-dom";
import { ExchangeRatesPanel } from "../components/ExchangeRatesPanel";
import { SiteFooter } from "../components/SiteFooter";
import { StorageUsagePanel, type StorageUsageModel } from "../components/StorageUsagePanel";
import type { ExchangeRateRow } from "../components/ExchangeRatesPanel";
import {
  AppSettings,
  HOME_SECTION_LABELS,
  HomeSectionKey,
  TOGGLEABLE_HOME_SECTIONS,
  isToggleableHomeSection,
} from "../lib/appSettings";
import { readLlmApiSettings, saveLlmApiSettings } from "../lib/llmApiSettings";

export type BackupImportPreview = {
  fileName: string;
  exportedAt: string;
  incomingLedger: { dateCount: number; recordCount: number };
  currentLedger: { dateCount: number; recordCount: number };
  settingsWillOverwrite: boolean;
  travelHistoryCount: number;
  currentTravelHistoryCount: number;
  llmApiWillOverwrite: boolean;
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
  storageUsage: StorageUsageModel;
};

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
  storageUsage,
}: SettingsPageProps) {
  const [includeLlmApiInBackup, setIncludeLlmApiInBackup] = useState(
    () => readLlmApiSettings().includeInBackup,
  );

  const updateIncludeLlmApiInBackup = (checked: boolean) => {
    setIncludeLlmApiInBackup(checked);
    saveLlmApiSettings({ ...readLlmApiSettings(), includeInBackup: checked });
  };

  const updateSection = (key: HomeSectionKey, checked: boolean) => {
    if (!isToggleableHomeSection(key)) return;
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
    <main
      className="app-shell app-shell--below-nav settings-page-shell"
      data-section="settings-page"
    >
      <div className="content-rail settings-stack">
        <header className="page-intro" data-section="settings-hero">
          <p className="eyebrow">Settings</p>
          <h1>设置</h1>
          <p className="muted">
            管理可选区块、预算、汇率与完整 JSON 备份。自然语言记账的 API 密钥请到{" "}
            <Link to="/console">API 看台</Link> 填写。CSV 导入导出请前往「数据管理」。
          </p>
        </header>

        <section className="settings-stack__section">
          <header className="settings-stack__heading">
            <h2>可选区块</h2>
            <p className="muted">仅以下 4 项可隐藏；记账、今日明细等核心路径始终保留。</p>
          </header>
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
          <ul className="settings-option-list" data-section="home-section-toggles">
            {TOGGLEABLE_HOME_SECTIONS.map((key) => (
              <li key={key} className="settings-option">
                <div className="settings-option__copy">
                  <strong>{HOME_SECTION_LABELS[key]}</strong>
                  <small>
                    {key === "heroCards"
                      ? "开启后在记账页显示趣味小卡片"
                      : key === "tools"
                        ? "控制「全年」趋势与预算卡片"
                        : "控制对应统计页是否出现在导航中"}
                  </small>
                </div>
                <label className="settings-toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.homeSections[key]}
                    aria-label={`${HOME_SECTION_LABELS[key]} 显示`}
                    onChange={(event) => updateSection(key, event.target.checked)}
                  />
                  <span className="settings-toggle-switch__track" aria-hidden="true" />
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="settings-stack__section surface-secondary">
          <header className="settings-stack__heading">
            <h2>预算管理</h2>
            <p className="muted">默认关闭；开启后可在全年页查看月度与分类预算。</p>
          </header>
          <div className="budget-settings-stack">
            <div className="settings-option">
              <span className="settings-option__copy">
                <strong>开启预算管理</strong>
                <small>不会改动已有账本数据。</small>
              </span>
              <label className="settings-toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.budget.enabled}
                  aria-label="开启预算管理"
                  onChange={(event) => updateBudget({ enabled: event.target.checked })}
                />
                <span className="settings-toggle-switch__track" aria-hidden="true" />
              </label>
            </div>
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
                  onChange={(event) =>
                    updateBudget({
                      monthlyLimit:
                        Number(event.target.value) > 0 ? Number(event.target.value) : null,
                    })
                  }
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
        </section>

        <section className="settings-stack__section surface-secondary backup-panel">
          <header className="settings-stack__heading">
            <h2>完整 JSON 备份</h2>
            <p className="muted">包含账本、汇率、主题、提醒、设置与旅游历史。导入前会展示预览。</p>
          </header>
          <div className="settings-option">
            <span className="settings-option__copy">
              <strong>把 API 接口写入备份</strong>
              <small>
                开启后导出的 JSON 会含 Base
                URL、模型名和密钥，换设备导入即可直接用。请自行保管备份文件。
              </small>
            </span>
            <label className="settings-toggle-switch">
              <input
                type="checkbox"
                checked={includeLlmApiInBackup}
                aria-label="把 API 接口写入备份"
                onChange={(event) => updateIncludeLlmApiInBackup(event.target.checked)}
              />
              <span className="settings-toggle-switch__track" aria-hidden="true" />
            </label>
          </div>
          <div className="backup-action-stack">
            <div className="backup-action-stack__buttons">
              <button type="button" data-action="json-backup-export" onClick={onExportJson}>
                立即导出 JSON
              </button>
              <button
                type="button"
                className="secondary-button"
                data-action="json-backup-pick-import"
                onClick={onPickJson}
              >
                选择 JSON 导入
              </button>
            </div>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={onJsonFileChange}
            />
            <div className="backup-action-stack__nudge">
              <p className="muted">当前提醒状态：{backupReminderLabel}</p>
              <div className="action-row">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onSnoozeBackupReminder(1)}
                >
                  明天提醒
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onSnoozeBackupReminder(3)}
                >
                  3 天内不提醒
                </button>
              </div>
            </div>
          </div>
          {importMessage ? <p className="status">{importMessage}</p> : null}
        </section>

        <StorageUsagePanel usage={storageUsage} />

        <section className="settings-stack__section surface-secondary">
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
        </section>

        {importPreview ? (
          <section
            className="settings-stack__section surface-secondary import-preview"
            aria-live="polite"
          >
            <header className="settings-stack__heading">
              <h2>导入前预览</h2>
              <p className="muted">
                文件：{importPreview.fileName} · 导出时间：
                {new Date(importPreview.exportedAt).toLocaleString("zh-CN")}
              </p>
            </header>
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
              <div>
                <span>API 接口</span>
                <strong>{importPreview.llmApiWillOverwrite ? "会覆盖密钥与接口" : "不改动"}</strong>
              </div>
            </div>
            <p className="warning-text">
              确认后会用备份文件替换当前账本、设置、旅游状态与相关本地缓存
              {importPreview.llmApiWillOverwrite ? "，并覆盖本机 API 接口与密钥" : ""}。
            </p>
            <div className="action-row">
              <button
                type="button"
                className="danger-button"
                data-action="json-backup-confirm-import"
                onClick={onConfirmJsonImport}
              >
                确认覆盖导入
              </button>
              <button type="button" className="secondary-button" onClick={onCancelJsonImport}>
                取消
              </button>
            </div>
          </section>
        ) : null}

        <SiteFooter />
      </div>
    </main>
  );
}
