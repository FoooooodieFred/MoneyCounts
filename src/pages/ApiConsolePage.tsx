import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateKey } from "../lib/dateRange";
import { LEDGER_CATEGORIES } from "../lib/nlLedgerCategories";
import {
  LLM_PROVIDER_PRESETS,
  applyLlmProviderPreset,
  getLlmProviderPreset,
  isLlmApiConfigured,
  normalizeLlmApiSettings,
  readLlmApiSettings,
  saveLlmApiSettings,
  type LlmApiSettings,
  type LlmProviderId,
} from "../lib/llmApiSettings";
import { buildDefaultLedgerSystemPrompt } from "../lib/llmLedgerPrompt";
import { parseNaturalLedgerViaLlm } from "../lib/llmLedgerParser";
import { testLlmConnection } from "../lib/llmChatClient";
import {
  appendLlmCallLog,
  clearLlmSessionContext,
  hostFromBaseUrl,
  readLlmCallLog,
  type LlmCallLogEntry,
} from "../lib/llmCallLog";
import type { LocalLedgerParseResult } from "../lib/localLedgerParser";

const PLAYGROUND_CURRENCIES = ["HKD", "CNY", "USD", "JPY"] as const;
const DEFAULT_PLAYGROUND = "今天午餐 45 港币，朋友还我 100，这一周每天地铁来回 10.8HKD";

const formatLogTime = (at: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));

export function ApiConsolePage() {
  const [settings, setSettings] = useState<LlmApiSettings>(() => readLlmApiSettings());
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [playgroundInput, setPlaygroundInput] = useState(DEFAULT_PLAYGROUND);
  const [playgroundCurrency, setPlaygroundCurrency] = useState<"HKD" | "CNY">("HKD");
  const [playgroundResult, setPlaygroundResult] = useState<LocalLedgerParseResult | null>(null);
  const [playgroundError, setPlaygroundError] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [callLog, setCallLog] = useState<LlmCallLogEntry[]>(() => readLlmCallLog());

  const configured = isLlmApiConfigured(settings);
  const locked = settings.verified;
  const defaultPrompt = useMemo(() => buildDefaultLedgerSystemPrompt(), []);
  const modelPlaceholder = getLlmProviderPreset(settings.provider).modelPlaceholder;
  const urlPlaceholder =
    getLlmProviderPreset(settings.provider).baseUrl || "https://api.example.com/v1";

  const persist = (next: LlmApiSettings) => {
    const normalized = normalizeLlmApiSettings(next);
    setSettings(normalized);
    saveLlmApiSettings(normalized);
  };

  const handleTest = async () => {
    if (!isLlmApiConfigured(settings)) {
      setTestStatus("请先填写 Base URL、模型名和 API Key。");
      return;
    }
    setIsTesting(true);
    setTestStatus("正在连通…");
    const started = Date.now();
    try {
      await testLlmConnection(settings);
      appendLlmCallLog({
        at: Date.now(),
        model: settings.model,
        host: hostFromBaseUrl(settings.baseUrl),
        ok: true,
        latencyMs: Date.now() - started,
        inputChars: 0,
      });
      persist({ ...settings, verified: true });
      setTestStatus("连通成功。接口已锁定，可回记账页。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "连通失败。";
      appendLlmCallLog({
        at: Date.now(),
        model: settings.model,
        host: hostFromBaseUrl(settings.baseUrl),
        ok: false,
        latencyMs: Date.now() - started,
        inputChars: 0,
        error: message,
      });
      persist({ ...settings, verified: false });
      setTestStatus(message);
    } finally {
      setCallLog(readLlmCallLog());
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    persist({ ...settings, verified: false });
    setTestStatus("已解锁，可修改 URL、模型与密钥后重新测试。");
  };

  const handleClearContext = () => {
    clearLlmSessionContext();
    setCallLog([]);
    setPlaygroundResult(null);
    setPlaygroundError("");
    setPlaygroundInput(DEFAULT_PLAYGROUND);
    persist({ ...settings, customSystemPrompt: "" });
    setTestStatus("已清空本次会话的调用记录、试运行结果与自定义提示词。");
  };

  const handlePlayground = async (event: FormEvent) => {
    event.preventDefault();
    const text = playgroundInput.trim();
    if (!text) {
      setPlaygroundError("请输入一句账单。");
      return;
    }
    if (!isLlmApiConfigured(settings)) {
      setPlaygroundError("请先在上方填好接口。");
      return;
    }
    setIsPlaying(true);
    setPlaygroundError("");
    setPlaygroundResult(null);
    try {
      const result = await parseNaturalLedgerViaLlm(
        text,
        {
          selectedDate: formatDateKey(new Date()),
          defaultCurrency: playgroundCurrency,
          categories: LEDGER_CATEGORIES,
          currencies: [...PLAYGROUND_CURRENCIES],
        },
        settings,
      );
      setPlaygroundResult(result);
    } catch (error) {
      setPlaygroundError(error instanceof Error ? error.message : "试运行失败。");
    } finally {
      setCallLog(readLlmCallLog());
      setIsPlaying(false);
    }
  };

  return (
    <main className="app-shell app-shell--below-nav settings-page-shell" data-section="api-console">
      <div className="content-rail settings-stack">
        <header className="page-intro" data-section="console-hero">
          <p className="eyebrow">Console</p>
          <h1>API 看台</h1>
          <p className="muted">
            记账默认仍用关键词解析。填好接口并测试连通后，首页快捷模板可由模型生成，看台里也可试运行。密钥默认只存在本机；若要换设备，可在下方勾选写入
            JSON 备份。
          </p>
        </header>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>接入</h2>
            <p className="muted">
              {locked
                ? "已锁定。需要改接口时点「重新设置」。"
                : "选一家接口，填入模型名与密钥，再测试连通。"}
            </p>
          </header>

          <div className="console-presets" role="group" aria-label="接口预设">
            {LLM_PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={settings.provider === preset.id ? "nl-chip is-active" : "nl-chip"}
                aria-pressed={settings.provider === preset.id}
                disabled={locked}
                onClick={() =>
                  persist(applyLlmProviderPreset(settings, preset.id as LlmProviderId))
                }
              >
                {preset.label}
              </button>
            ))}
          </div>

          <label className="console-field">
            Base URL
            <input
              value={settings.baseUrl}
              autoComplete="off"
              spellCheck={false}
              placeholder={urlPlaceholder}
              disabled={locked}
              onChange={(event) =>
                persist({ ...settings, baseUrl: event.target.value, verified: false })
              }
            />
          </label>

          <label className="console-field">
            模型
            <input
              value={settings.model}
              autoComplete="off"
              spellCheck={false}
              placeholder={modelPlaceholder}
              disabled={locked}
              onChange={(event) =>
                persist({ ...settings, model: event.target.value, verified: false })
              }
            />
          </label>

          <div className="console-field">
            <span>API Key</span>
            <span className="console-key-row">
              <input
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder="sk-…"
                aria-label="API Key"
                disabled={locked}
                onChange={(event) =>
                  persist({ ...settings, apiKey: event.target.value, verified: false })
                }
              />
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowKey((value) => !value)}
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </span>
          </div>

          <label className="settings-option">
            <span className="settings-option__copy">
              <strong>JSON Mode</strong>
              <small>
                请求 response_format=json_object。若供应商不支持，解析时会自动关掉再试。
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.jsonMode}
              disabled={locked}
              onChange={(event) => persist({ ...settings, jsonMode: event.target.checked })}
            />
          </label>

          <label className="settings-option">
            <span className="settings-option__copy">
              <strong>把 API 写入 JSON 备份</strong>
              <small>
                开启后，设置页导出的备份会带上接口地址、模型名和密钥，换设备导入即可直接用。
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.includeInBackup}
              onChange={(event) => persist({ ...settings, includeInBackup: event.target.checked })}
            />
          </label>

          <div className="action-row">
            {locked ? (
              <button type="button" className="secondary-button" onClick={handleReset}>
                重新设置
              </button>
            ) : (
              <button
                type="button"
                disabled={isTesting || !configured}
                onClick={() => void handleTest()}
              >
                {isTesting ? "连通中…" : "测试连通"}
              </button>
            )}
            {locked ? (
              <button type="button" className="ghost-button" onClick={handleClearContext}>
                清空上下文
              </button>
            ) : null}
            <Link to="/" className="secondary-button console-text-link">
              回记账页
            </Link>
          </div>
          {testStatus ? <p className="status">{testStatus}</p> : null}
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>提示词</h2>
            <p className="muted">
              默认提示词已写好 35 类、金额符号、AA / 退款、以及 date_spec 展开规则。一般不用改。
            </p>
          </header>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowDefaultPrompt((value) => !value)}
            >
              {showDefaultPrompt ? "收起默认提示词" : "查看默认提示词"}
            </button>
            {settings.customSystemPrompt.trim() ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => persist({ ...settings, customSystemPrompt: "" })}
              >
                恢复默认
              </button>
            ) : null}
          </div>
          {showDefaultPrompt ? (
            <pre className="console-prompt" tabIndex={0}>
              {defaultPrompt}
            </pre>
          ) : null}
          <label className="console-field">
            自定义系统提示词（留空即用默认）
            <textarea
              rows={8}
              value={settings.customSystemPrompt}
              placeholder="留空则使用上面的默认提示词"
              onChange={(event) => persist({ ...settings, customSystemPrompt: event.target.value })}
            />
          </label>
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>试运行</h2>
            <p className="muted">
              用当前密钥跑一遍，看模型吐出的词条。记账首页默认仍走关键词解析。
            </p>
          </header>
          <form className="console-playground" onSubmit={(event) => void handlePlayground(event)}>
            <div className="nl-currency-toggle" role="group" aria-label="试运行默认货币">
              {(["CNY", "HKD"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  className={playgroundCurrency === currency ? "active" : undefined}
                  aria-pressed={playgroundCurrency === currency}
                  onClick={() => setPlaygroundCurrency(currency)}
                >
                  {currency}
                </button>
              ))}
            </div>
            <label className="console-field">
              自然语言
              <textarea
                rows={4}
                value={playgroundInput}
                onChange={(event) => setPlaygroundInput(event.target.value)}
                placeholder="用一句话记下开销…"
              />
            </label>
            <button type="submit" disabled={isPlaying || !configured}>
              {isPlaying ? "识别中…" : "生成词条"}
            </button>
          </form>
          {playgroundError ? <p className="nl-error">{playgroundError}</p> : null}
          {playgroundResult ? (
            <div className="console-playground-result">
              {playgroundResult.records.length ? (
                <div className="nl-preview-table-wrap">
                  <table className="nl-preview-table">
                    <thead>
                      <tr>
                        <th scope="col">日期</th>
                        <th scope="col">分类</th>
                        <th scope="col">金额</th>
                        <th scope="col">货币</th>
                        <th scope="col">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playgroundResult.records.map((row, index) => (
                        <tr key={`${row.date}-${row.category}-${index}`}>
                          <td>{row.date}</td>
                          <td>{row.category}</td>
                          <td>{row.amount}</td>
                          <td>{row.currency}</td>
                          <td>{row.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">没有展开出词条。</p>
              )}
              {playgroundResult.warnings.length ? (
                <div className="nl-preview-warnings">
                  {playgroundResult.warnings.map((warning) => (
                    <small key={warning}>{warning}</small>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>最近调用</h2>
            <p className="muted">只记本会话；关闭浏览器后自动清空。不记密钥和账单原文。</p>
          </header>
          {callLog.length ? (
            <ul className="settings-option-list">
              {callLog.map((entry) => (
                <li key={`${entry.at}-${entry.model}`} className="settings-option">
                  <div className="settings-option__copy">
                    <strong>
                      {entry.ok ? "成功" : "失败"} · {entry.model}
                    </strong>
                    <small>
                      {formatLogTime(entry.at)} · {entry.host} · {entry.latencyMs}ms
                      {typeof entry.entryCount === "number" ? ` · ${entry.entryCount} 笔` : ""}
                      {entry.error ? ` · ${entry.error}` : ""}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">还没有调用记录。</p>
          )}
        </section>
      </div>
    </main>
  );
}
