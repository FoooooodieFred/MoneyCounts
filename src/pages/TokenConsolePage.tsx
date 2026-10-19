import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  clearLlmUsage,
  formatCost,
  formatTokenCount,
  LLM_USAGE_SCENE_LABELS,
  readLlmUsage,
  summarizeLlmUsage,
  subscribeLlmUsage,
  type LlmUsageRecord,
} from "../lib/llmUsage";

type RangeKey = "today" | "week" | "month" | "all";

const RANGE_OPTIONS: Array<{ id: RangeKey; label: string; days: number | null }> = [
  { id: "today", label: "今天", days: 1 },
  { id: "week", label: "近 7 天", days: 7 },
  { id: "month", label: "近 30 天", days: 30 },
  { id: "all", label: "全部", days: null },
];

const dayKey = (at: number) => {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const formatTime = (at: number) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));

const withinRange = (record: LlmUsageRecord, days: number | null, today: string) => {
  if (days === null) return true;
  if (days === 1) return dayKey(record.at) === today;
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return record.at >= threshold;
};

export function TokenConsolePage() {
  const [records, setRecords] = useState<LlmUsageRecord[]>(() => readLlmUsage());
  const [range, setRange] = useState<RangeKey>("week");

  useEffect(() => {
    setRecords(readLlmUsage());
    return subscribeLlmUsage(() => setRecords(readLlmUsage()));
  }, []);

  const today = dayKey(Date.now());
  const days = RANGE_OPTIONS.find((option) => option.id === range)?.days ?? null;
  const filtered = useMemo(
    () => records.filter((record) => withinRange(record, days, today)),
    [records, days, today],
  );
  const summary = useMemo(() => summarizeLlmUsage(filtered), [filtered]);

  const maxDayTokens = Math.max(1, ...summary.byDay.map((item) => item.totalTokens));

  return (
    <main className="app-shell app-shell--below-nav settings-page-shell" data-section="token-console">
      <div className="content-rail settings-stack">
        <header className="page-intro" data-section="token-hero">
          <p className="eyebrow">Tokens</p>
          <h1>Token 看台</h1>
          <p className="muted">
            每次模型调用都记在这里：输入输出 token、耗时、场景和估算费用。数据只存在本机，不进 JSON
            备份。上游没有报用量时按字数估算，表格里会标出来。
          </p>
        </header>

        <section className="settings-stack__section surface-secondary console-card">
          <div className="console-presets" role="group" aria-label="时间范围">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={range === option.id ? "nl-chip is-active" : "nl-chip"}
                aria-pressed={range === option.id}
                onClick={() => setRange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="token-kpi-grid">
            <div className="token-kpi">
              <span className="token-kpi__label">调用次数</span>
              <strong className="token-kpi__value">{summary.calls}</strong>
              <small className="muted">
                成功 {summary.okCalls} · 失败 {summary.failedCalls}
              </small>
            </div>
            <div className="token-kpi">
              <span className="token-kpi__label">输入 token</span>
              <strong className="token-kpi__value">{formatTokenCount(summary.promptTokens)}</strong>
              <small className="muted">提示词 + 工具定义</small>
            </div>
            <div className="token-kpi">
              <span className="token-kpi__label">输出 token</span>
              <strong className="token-kpi__value">
                {formatTokenCount(summary.completionTokens)}
              </strong>
              <small className="muted">模型回复</small>
            </div>
            <div className="token-kpi">
              <span className="token-kpi__label">总 token</span>
              <strong className="token-kpi__value">{formatTokenCount(summary.totalTokens)}</strong>
              <small className="muted">输入 + 输出</small>
            </div>
            <div className="token-kpi">
              <span className="token-kpi__label">估算费用</span>
              <strong className="token-kpi__value">{formatCost(summary.cost)}</strong>
              <small className="muted">按档案里填的单价算</small>
            </div>
          </div>
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>按模型</h2>
            <p className="muted">每套档案分开统计，方便对比不同模型的成本。</p>
          </header>
          {summary.byModel.length ? (
            <div className="nl-preview-table-wrap">
              <table className="nl-preview-table">
                <thead>
                  <tr>
                    <th scope="col">模型</th>
                    <th scope="col">档案</th>
                    <th scope="col">次数</th>
                    <th scope="col">token</th>
                    <th scope="col">费用</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byModel.map((item) => (
                    <tr key={`${item.profileName}-${item.model}`}>
                      <td>{item.model || "—"}</td>
                      <td>{item.profileName}</td>
                      <td>{item.calls}</td>
                      <td>{formatTokenCount(item.totalTokens)}</td>
                      <td>{formatCost(item.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">这个范围内还没有调用。</p>
          )}
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>按场景</h2>
            <p className="muted">看看 token 花在哪个功能上。</p>
          </header>
          {summary.byScene.length ? (
            <ul className="settings-option-list">
              {summary.byScene.map((item) => (
                <li key={item.scene} className="settings-option">
                  <div className="settings-option__copy">
                    <strong>{LLM_USAGE_SCENE_LABELS[item.scene] ?? item.scene}</strong>
                    <small>
                      {item.calls} 次 · {formatTokenCount(item.totalTokens)} token
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">这个范围内还没有调用。</p>
          )}
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>按天</h2>
            <p className="muted">最近几天的 token 用量。</p>
          </header>
          {summary.byDay.length ? (
            <ul className="token-day-list">
              {summary.byDay.slice(0, 14).map((item) => (
                <li key={item.day} className="token-day">
                  <span className="token-day__label">{item.day.slice(5)}</span>
                  <span className="token-day__bar" aria-hidden="true">
                    <span
                      className="token-day__fill"
                      style={{ width: `${Math.round((item.totalTokens / maxDayTokens) * 100)}%` }}
                    />
                  </span>
                  <span className="token-day__value">
                    {item.calls} 次 · {formatTokenCount(item.totalTokens)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">这个范围内还没有调用。</p>
          )}
        </section>

        <section className="settings-stack__section surface-secondary console-card">
          <header className="settings-stack__heading">
            <h2>明细</h2>
            <p className="muted">最多保留 500 条。只记模型、场景和 token 数，不记密钥与账单原文。</p>
          </header>
          {filtered.length ? (
            <div className="nl-preview-table-wrap">
              <table className="nl-preview-table">
                <thead>
                  <tr>
                    <th scope="col">时间</th>
                    <th scope="col">模型</th>
                    <th scope="col">场景</th>
                    <th scope="col">输入</th>
                    <th scope="col">输出</th>
                    <th scope="col">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 80).map((record, index) => (
                    <tr key={`${record.at}-${index}`}>
                      <td>{formatTime(record.at)}</td>
                      <td>
                        {record.model || "—"}
                        {record.estimated ? <small className="muted"> ·估</small> : null}
                      </td>
                      <td>{LLM_USAGE_SCENE_LABELS[record.scene] ?? record.scene}</td>
                      <td>{formatTokenCount(record.promptTokens)}</td>
                      <td>{formatTokenCount(record.completionTokens)}</td>
                      <td>{record.latencyMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">这个范围内还没有调用。</p>
          )}
          <div className="action-row">
            <Link to="/console" className="secondary-button console-text-link">
              回到 API 看台
            </Link>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                clearLlmUsage();
                setRecords(readLlmUsage());
              }}
            >
              清空用量记录
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
