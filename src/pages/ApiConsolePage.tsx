import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateKey } from "../lib/dateRange";
import { LEDGER_CATEGORIES } from "../lib/nlLedgerCategories";
import {
  activeLlmProfile,
  addLlmProvider,
  applyLlmProviderPreset,
  createLlmProfile,
  estimateLlmCost,
  isLlmApiConfigured,
  LLM_API_STYLES,
  LLM_PROVIDER_PRESETS,
  normalizeLlmApiStore,
  readLlmApiStore,
  removeLlmProfile,
  removeLlmProvider,
  saveLlmApiStore,
  updateLlmProfile,
  type LlmApiSettings,
  type LlmApiStore,
  type LlmProviderPreset,
} from "../lib/llmApiSettings";
import { buildDefaultLedgerSystemPrompt, LLM_PROMPT_MODES } from "../lib/llmLedgerPrompt";
import { parseNaturalLedgerViaLlm } from "../lib/llmLedgerParser";
import { fetchLlmModels, testLlmConnection } from "../lib/llmChatClient";
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

/** 数字输入框：留空表示「不发送这个参数」。 */
const OptionalNumberInput = ({
  value,
  onChange,
  placeholder,
  step,
  min,
  max,
  label,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  label: string;
}) => (
  <label className="console-field">
    {label}
    <input
      type="number"
      inputMode="decimal"
      value={value === null ? "" : String(value)}
      step={step}
      min={min}
      max={max}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (!raw) {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
    />
  </label>
);

const KeyValueEditor = ({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) => {
  const rows = Object.entries(value);
  const update = (index: number, key: string, item: string) => {
    const next = rows.map(([rowKey, rowValue], rowIndex) =>
      rowIndex === index ? [key, item] : [rowKey, rowValue],
    );
    onChange(Object.fromEntries(next.filter(([rowKey]) => rowKey.trim() !== "")));
  };
  return (
    <div className="console-kv">
      {rows.length ? (
        rows.map(([key, item], index) => (
          <div className="console-kv__row" key={`${key}-${index}`}>
            <input
              value={key}
              placeholder={keyPlaceholder}
              onChange={(event) => update(index, event.target.value, item)}
            />
            <input
              value={item}
              placeholder={valuePlaceholder}
              onChange={(event) => update(index, key, event.target.value)}
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() =>
                onChange(Object.fromEntries(rows.filter((_, rowIndex) => rowIndex !== index)))
              }
            >
              删
            </button>
          </div>
        ))
      ) : (
        <p className="muted console-kv__empty">还没有内容。</p>
      )}
      <button
        type="button"
        className="secondary-button"
        onClick={() => onChange({ ...value, "": "" })}
      >
        添加一行
      </button>
    </div>
  );
};

export function ApiConsolePage() {
  const [store, setStore] = useState<LlmApiStore>(() => readLlmApiStore());
  const settings = useMemo(() => activeLlmProfile(store), [store]);
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
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelStatus, setModelStatus] = useState("");
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [newProvider, setNewProvider] = useState({
    label: "",
    baseUrl: "",
    modelPlaceholder: "",
    apiStyle: "chat-completions" as LlmApiSettings["apiStyle"],
  });

  const configured = isLlmApiConfigured(settings);
  const locked = settings.verified;
  const defaultPrompt = useMemo(() => buildDefaultLedgerSystemPrompt(), []);
  const provider = useMemo(
    () =>
      store.providers.find((item) => item.id === settings.provider) ?? LLM_PROVIDER_PRESETS[0],
    [settings.provider, store.providers],
  );
  const modelPlaceholder = provider.modelPlaceholder || "your-model-id";
  const urlPlaceholder = provider.baseUrl || "https://api.example.com/v1";

  const persist = useCallback((next: LlmApiStore) => {
    const normalized = normalizeLlmApiStore(next);
    setStore(normalized);
    saveLlmApiStore(normalized);
  }, []);

  const patchProfile = useCallback(
    (patch: Partial<LlmApiSettings>) => {
      persist(updateLlmProfile(store, settings.profileId, patch));
    },
    [persist, settings.profileId, store],
  );

  useEffect(() => {
    setDiscoveredModels([]);
    setModelStatus("");
  }, [settings.profileId]);

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
      patchProfile({ verified: true });
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
      patchProfile({ verified: false });
      setTestStatus(message);
    } finally {
      setCallLog(readLlmCallLog());
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    patchProfile({ verified: false });
    setTestStatus("已解锁，可修改 URL、模型与密钥后重新测试。");
  };

  const handleClearContext = () => {
    clearLlmSessionContext();
    setCallLog([]);
    setPlaygroundResult(null);
    setPlaygroundError("");
    setPlaygroundInput(DEFAULT_PLAYGROUND);
    patchProfile({ customSystemPrompt: "" });
    setTestStatus("已清空本次会话的调用记录、试运行结果与自定义提示词。");
  };

  const handleFetchModels = async () => {
    if (!settings.apiKey || !settings.baseUrl) {
      setModelStatus("先填 Base URL 和 API Key 再拉取模型列表。");
      return;
    }
    setIsFetchingModels(true);
    setModelStatus("正在拉取模型列表…");
    try {
      const models = await fetchLlmModels(settings);
      setDiscoveredModels(models);
      setModelStatus(models.length ? `拉到 ${models.length} 个模型。` : "接口没有返回模型列表。");
    } catch (error) {
      setDiscoveredModels([]);
      setModelStatus(error instanceof Error ? error.message : "拉取失败。");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddProfile = () => {
    const created = createLlmProfile(settings);
    persist({ ...store, profiles: [...store.profiles, created], activeProfileId: created.profileId });
    setTestStatus("已新建档案，填好地址与密钥后测试连通。");
  };

  const handleDuplicateProfile = () => {
    const created = createLlmProfile(settings);
    persist({ ...store, profiles: [...store.profiles, created], activeProfileId: created.profileId });
    setTestStatus("已复制当前档案。");
  };

  const handleRemoveProfile = () => {
    if (store.profiles.length <= 1) {
      setTestStatus("至少保留一个档案。");
      return;
    }
    const next = removeLlmProfile(store, settings.profileId);
    persist(next);
    setTestStatus("档案已删除。");
  };

  const handleAddProvider = () => {
    const label = newProvider.label.trim();
    const baseUrl = newProvider.baseUrl.trim();
    if (!label || !baseUrl) {
      setTestStatus("自定义供应商需要名称和 Base URL。");
      return;
    }
    const preset: Omit<LlmProviderPreset, "id" | "builtIn"> = {
      label,
      baseUrl,
      modelPlaceholder: newProvider.modelPlaceholder.trim() || "your-model-id",
      apiStyle: newProvider.apiStyle,
      models: [],
      extraHeaders: {},
      extraBody: {},
    };
    const next = addLlmProvider(store, preset);
    persist(next);
    patchProfile({ provider: preset.label ? next.providers.at(-1)?.id ?? settings.provider : settings.provider });
    setShowProviderForm(false);
    setNewProvider({ label: "", baseUrl: "", modelPlaceholder: "", apiStyle: "chat-completions" });
    setTestStatus("已添加自定义供应商。");
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

  const estimatedCost = estimateLlmCost(settings, 1000, 1000);

  return (
    <main className="app-shell app-shell--below-nav settings-page-shell" data-section="api-console">
      <div className="content-rail settings-stack">
        <header className="page-intro" data-section="console-hero">
          <p className="eyebrow">Console</p>
          <h1>API 看台</h1>
          <p className="muted">
            记账默认仍用关键词解析。填好接口并测试连通后，首页快捷模板可由模型生成，看台里也可试运行。
            可以建多套连接档案随时切换，接入新模型不必改代码。密钥默认只存在本机；若要换设备，可在下方勾选写入
            JSON 备份。
          </p>
        </header>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>档案</h2>
            <p className="muted">每套档案有自己的地址、模型、密钥与生成参数。当前生效的是高亮那一个。</p>
          </header>
          <div className="console-presets" role="group" aria-label="连接档案">
            {store.profiles.map((item) => (
              <button
                key={item.profileId}
                type="button"
                className={item.profileId === settings.profileId ? "nl-chip is-active" : "nl-chip"}
                aria-pressed={item.profileId === settings.profileId}
                onClick={() => persist({ ...store, activeProfileId: item.profileId })}
              >
                {item.profileName}
              </button>
            ))}
          </div>
          <div className="action-row">
            <button type="button" className="secondary-button" onClick={handleAddProfile}>
              新建档案
            </button>
            <button type="button" className="secondary-button" onClick={handleDuplicateProfile}>
              复制当前
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={handleRemoveProfile}
              disabled={store.profiles.length <= 1}
            >
              删除当前
            </button>
          </div>
          <label className="console-field">
            档案名
            <input
              value={settings.profileName}
              onChange={(event) => patchProfile({ profileName: event.target.value })}
            />
          </label>
        </section>

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
            {store.providers.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={settings.provider === preset.id ? "nl-chip is-active" : "nl-chip"}
                aria-pressed={settings.provider === preset.id}
                disabled={locked}
                onClick={() => patchProfile(applyLlmProviderPreset(settings, preset.id, store.providers))}
              >
                {preset.label}
                {preset.builtIn ? null : " ·自定义"}
              </button>
            ))}
            <button
              type="button"
              className="nl-chip"
              onClick={() => setShowProviderForm((value) => !value)}
            >
              + 自定义供应商
            </button>
          </div>

          {showProviderForm ? (
            <div className="console-subcard">
              <p className="muted">
                自定义供应商只是记下地址和接口风格，接入后续新模型不用改代码。填好后点「添加」再选它。
              </p>
              <div className="console-grid">
                <label className="console-field">
                  名称
                  <input
                    value={newProvider.label}
                    placeholder="例如 公司网关"
                    onChange={(event) =>
                      setNewProvider((current) => ({ ...current, label: event.target.value }))
                    }
                  />
                </label>
                <label className="console-field">
                  Base URL
                  <input
                    value={newProvider.baseUrl}
                    placeholder="https://gateway.example.com/v1"
                    onChange={(event) =>
                      setNewProvider((current) => ({ ...current, baseUrl: event.target.value }))
                    }
                  />
                </label>
                <label className="console-field">
                  模型占位提示
                  <input
                    value={newProvider.modelPlaceholder}
                    placeholder="your-model-id"
                    onChange={(event) =>
                      setNewProvider((current) => ({
                        ...current,
                        modelPlaceholder: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="console-field">
                  接口风格
                  <select
                    value={newProvider.apiStyle}
                    onChange={(event) =>
                      setNewProvider((current) => ({
                        ...current,
                        apiStyle: event.target.value as LlmApiSettings["apiStyle"],
                      }))
                    }
                  >
                    {LLM_API_STYLES.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="action-row">
                <button type="button" onClick={handleAddProvider}>
                  添加
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowProviderForm(false)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {settings.provider !== "custom" &&
          !store.providers.find((item) => item.id === settings.provider)?.builtIn ? (
            <div className="action-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => persist(removeLlmProvider(store, settings.provider))}
              >
                删除这个自定义供应商
              </button>
            </div>
          ) : null}

          <label className="console-field">
            Base URL
            <input
              value={settings.baseUrl}
              autoComplete="off"
              spellCheck={false}
              placeholder={urlPlaceholder}
              disabled={locked}
              onChange={(event) => patchProfile({ baseUrl: event.target.value, verified: false })}
            />
          </label>

          <label className="console-field">
            模型
            <input
              value={settings.model}
              autoComplete="off"
              spellCheck={false}
              placeholder={modelPlaceholder}
              list="console-model-options"
              disabled={locked}
              onChange={(event) => patchProfile({ model: event.target.value, verified: false })}
            />
          </label>
          <datalist id="console-model-options">
            {[...new Set([...provider.models, ...discoveredModels])].map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleFetchModels()}
              disabled={isFetchingModels || locked}
            >
              {isFetchingModels ? "拉取中…" : "拉取模型列表"}
            </button>
            {modelStatus ? <span className="muted">{modelStatus}</span> : null}
          </div>

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
                onChange={(event) => patchProfile({ apiKey: event.target.value, verified: false })}
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

          <label className="console-field">
            接口风格
            <select
              value={settings.apiStyle}
              disabled={locked}
              onChange={(event) =>
                patchProfile({
                  apiStyle: event.target.value as LlmApiSettings["apiStyle"],
                  verified: false,
                })
              }
            >
              {LLM_API_STYLES.map((style) => (
                <option key={style.id} value={style.id}>
                  {style.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {LLM_API_STYLES.find((style) => style.id === settings.apiStyle)?.hint}
          </p>

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
            <h2>生成参数</h2>
            <p className="muted">
              这些参数会随每条档案一起保存。留空的项表示不发送，由模型或供应商自己决定。
            </p>
          </header>
          <div className="console-grid">
            <label className="console-field">
              temperature
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={settings.temperature}
                onChange={(event) =>
                  patchProfile({
                    temperature: Number.isFinite(Number(event.target.value))
                      ? Number(event.target.value)
                      : 0,
                  })
                }
              />
            </label>
            <OptionalNumberInput
              label="max_tokens"
              value={settings.maxTokens}
              min="1"
              placeholder="不限制"
              onChange={(value) => patchProfile({ maxTokens: value })}
            />
            <OptionalNumberInput
              label="top_p"
              value={settings.topP}
              step="0.05"
              min="0"
              max="1"
              placeholder="不发送"
              onChange={(value) => patchProfile({ topP: value })}
            />
            <OptionalNumberInput
              label="上下文长度（token）"
              value={settings.contextWindow}
              min="1"
              placeholder="例如 128000"
              onChange={(value) => patchProfile({ contextWindow: value })}
            />
            <OptionalNumberInput
              label="输入价（每百万 token）"
              value={settings.inputPricePerMillion}
              step="0.01"
              min="0"
              placeholder="不估算"
              onChange={(value) => patchProfile({ inputPricePerMillion: value })}
            />
            <OptionalNumberInput
              label="输出价（每百万 token）"
              value={settings.outputPricePerMillion}
              step="0.01"
              min="0"
              placeholder="不估算"
              onChange={(value) => patchProfile({ outputPricePerMillion: value })}
            />
          </div>
          {estimatedCost !== null ? (
            <p className="muted">按当前价格，1000 输入 + 1000 输出约 ${estimatedCost.toFixed(4)}。</p>
          ) : null}

          <label className="settings-option">
            <span className="settings-option__copy">
              <strong>JSON Mode</strong>
              <small>请求 response_format=json_object。若供应商不支持，解析时会自动关掉再试。</small>
            </span>
            <input
              type="checkbox"
              checked={settings.jsonMode}
              disabled={locked}
              onChange={(event) => patchProfile({ jsonMode: event.target.checked })}
            />
          </label>

          <label className="settings-option">
            <span className="settings-option__copy">
              <strong>支持工具调用</strong>
              <small>关掉后 MoneyMore 不会把查账工具发给模型，只做纯对话。</small>
            </span>
            <input
              type="checkbox"
              checked={settings.supportsTools}
              disabled={locked}
              onChange={(event) => patchProfile({ supportsTools: event.target.checked })}
            />
          </label>

          <label className="settings-option">
            <span className="settings-option__copy">
              <strong>把 API 写入 JSON 备份</strong>
              <small>开启后，设置页导出的备份会带上接口地址、模型名和密钥，换设备导入即可直接用。</small>
            </span>
            <input
              type="checkbox"
              checked={settings.includeInBackup}
              onChange={(event) => patchProfile({ includeInBackup: event.target.checked })}
            />
          </label>
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>高级</h2>
            <p className="muted">
              供应商特有的请求头和请求体参数写在这里，接入非标准网关时用得上。
            </p>
          </header>
          <div className="console-field">
            <span>额外请求头</span>
            <KeyValueEditor
              value={settings.extraHeaders}
              keyPlaceholder="Header 名"
              valuePlaceholder="值"
              onChange={(extraHeaders) => patchProfile({ extraHeaders })}
            />
          </div>
          <div className="console-field">
            <span>额外请求体（JSON）</span>
            <textarea
              rows={4}
              spellCheck={false}
              value={JSON.stringify(settings.extraBody, null, 2)}
              placeholder={'{\n  "reasoning_effort": "high"\n}'}
              onChange={(event) => {
                const raw = event.target.value.trim();
                if (!raw) {
                  patchProfile({ extraBody: {} });
                  return;
                }
                try {
                  const parsed = JSON.parse(raw) as unknown;
                  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                    patchProfile({ extraBody: parsed as Record<string, unknown> });
                  }
                } catch {
                  /* 输入还没写完时不打断 */
                }
              }}
            />
          </div>
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
                onClick={() => patchProfile({ customSystemPrompt: "" })}
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
          <div className="console-field">
            <span>自定义提示词怎么用</span>
            <div className="console-presets" role="group" aria-label="提示词模式">
              {LLM_PROMPT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={settings.promptMode === mode.id ? "nl-chip is-active" : "nl-chip"}
                  aria-pressed={settings.promptMode === mode.id}
                  onClick={() => patchProfile({ promptMode: mode.id })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <small className="muted">
              {LLM_PROMPT_MODES.find((mode) => mode.id === settings.promptMode)?.hint}
            </small>
          </div>
          <label className="console-field">
            自定义系统提示词（留空即用默认）
            <textarea
              rows={8}
              value={settings.customSystemPrompt}
              placeholder="留空则使用上面的默认提示词"
              onChange={(event) => patchProfile({ customSystemPrompt: event.target.value })}
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
          <div className="action-row">
            <Link to="/tokens" className="secondary-button console-text-link">
              打开 Token 看台
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
