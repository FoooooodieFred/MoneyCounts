import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { parseQuickExpenseLines, type QuickExpenseResult } from "../lib/quickExpenseParser";
import type { LocalLedgerRecord } from "../lib/localLedgerParser";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import { applyTemplateSlot, pickRandomTemplates } from "../lib/quickTemplates";

function resolveEntryScrollTarget(section: HTMLElement | null) {
  return (
    section ??
    document.getElementById("entry") ??
    document.querySelector<HTMLElement>('[data-section="quick-entry-slot"]')
  );
}

function focusTextareaAfterScroll(textarea: HTMLTextAreaElement | null, cursor?: number) {
  if (!textarea) return;
  const focus = () => {
    textarea.focus({ preventScroll: true });
    if (typeof cursor === "number") {
      textarea.setSelectionRange(cursor, cursor);
    }
  };
  if (typeof window !== "undefined" && "onscrollend" in window) {
    window.addEventListener("scrollend", focus, { once: true });
    return;
  }
  setTimeout(focus, prefersReducedMotion() ? 0 : 480);
}

type NaturalLanguageInputProps = {
  defaultCurrency: "CNY" | "HKD";
  categories: readonly string[];
  currencies: readonly string[];
  onDefaultCurrencyChange: (currency: "CNY" | "HKD") => void;
  onSubmit: (results: QuickExpenseResult[], rawInput: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClearStatus: () => void;
  onPreviewChange: (
    index: number,
    field: keyof Pick<LocalLedgerRecord, "date" | "category" | "amount" | "currency" | "note">,
    value: string,
  ) => void;
  onPreviewDelete: (index: number) => void;
  onPreviewAdd: () => void;
  previewRecords: LocalLedgerRecord[];
  previewIssues: string[][];
  warnings: string[];
  canConfirm: boolean;
  isParsing?: boolean;
  resetSignal?: number;
  statusMessage?: string;
  submittedInput?: string;
};

export function NaturalLanguageInput({
  defaultCurrency,
  categories,
  currencies,
  onDefaultCurrencyChange,
  onSubmit,
  onConfirm,
  onCancel,
  onClearStatus,
  onPreviewChange,
  onPreviewDelete,
  onPreviewAdd,
  previewRecords,
  previewIssues,
  warnings,
  canConfirm,
  isParsing = false,
  resetSignal = 0,
  statusMessage,
  submittedInput = "",
}: NaturalLanguageInputProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLFormElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCompactScrollRef = useRef(false);
  const [input, setInput] = useState("");
  const [previews, setPreviews] = useState<QuickExpenseResult[]>([]);
  const [error, setError] = useState("");
  const [compactVisible, setCompactVisible] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [templateSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const visibleTemplates = useMemo(() => pickRandomTemplates(3, templateSeed), [templateSeed]);

  const previewMode = previewRecords.length > 0;
  const bubbleText = submittedInput.trim() || input.trim();

  useEffect(() => {
    if (!input.trim()) {
      setPreviews([]);
      setError("");
      onClearStatus();
      return;
    }
    const parsed = parseQuickExpenseLines(input, defaultCurrency);
    setPreviews(parsed);
    setError(parsed.length ? "" : "需包含金额，例如「午餐 45 港币」");
  }, [input, defaultCurrency, onClearStatus]);

  useEffect(() => {
    const updateCompactVisibility = () => {
      const section = sectionRef.current;
      if (!section || previewMode) {
        setCompactVisible(false);
        return;
      }
      const rect = section.getBoundingClientRect();
      setCompactVisible(rect.bottom < 80);
    };

    updateCompactVisibility();
    window.addEventListener("scroll", updateCompactVisibility, { passive: true });
    window.addEventListener("resize", updateCompactVisibility);
    return () => {
      window.removeEventListener("scroll", updateCompactVisibility);
      window.removeEventListener("resize", updateCompactVisibility);
    };
  }, [previewMode]);

  useEffect(() => {
    if (!resetSignal) return;
    setInput("");
    setPreviews([]);
    pendingCompactScrollRef.current = false;
  }, [resetSignal]);

  useEffect(() => {
    if (!pendingCompactScrollRef.current || isParsing) return;
    pendingCompactScrollRef.current = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToEntryFromCompact();
      });
    });
  }, [isParsing, previewRecords]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fromCompact = event.currentTarget.classList.contains("nl-compact-entry");
    const rawInput = input;
    const parsed = parseQuickExpenseLines(rawInput, defaultCurrency);
    if (!parsed.length) {
      setError("无法解析，请检查是否包含金额");
      return;
    }
    onSubmit(parsed, rawInput);
    setError("");
    if (fromCompact) {
      pendingCompactScrollRef.current = true;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing)
      return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const focusMainInput = (cursor?: number) => {
    sectionRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    requestAnimationFrame(() => focusTextareaAfterScroll(textareaRef.current, cursor));
  };

  const scrollToEntryFromCompact = () => {
    const target = resolveEntryScrollTarget(sectionRef.current);
    if (!target) return;

    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest(".nl-compact-entry")) {
      active.blur();
    }

    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "start" });
    focusTextareaAfterScroll(textareaRef.current);
  };

  const applyTemplate = (template: string) => {
    const { text, cursor } = applyTemplateSlot(template);
    setInput((current) => {
      const trimmed = current.trim();
      const next = trimmed ? `${trimmed}\n${text}` : text;
      const focusAt = trimmed ? trimmed.length + 1 + cursor : cursor;
      requestAnimationFrame(() => focusMainInput(focusAt));
      return next;
    });
  };

  const handleEditPreview = () => {
    if (submittedInput.trim()) setInput(submittedInput);
    onCancel();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCancel = () => {
    onCancel();
    setError("");
  };

  return (
    <>
      <section
        ref={sectionRef}
        className={`nl-section is-visible${previewMode ? " is-thread" : " is-idle"}`}
        id="entry"
        data-section="quick-entry"
      >
        {!previewMode ? (
          <div className="nl-idle">
            <div className="nl-idle__bar">
              <h2 className="nl-idle__title">记一笔</h2>
              <div className="nl-currency-toggle" role="group" aria-label="默认货币">
                {(["CNY", "HKD"] as const).map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={defaultCurrency === currency ? "active" : undefined}
                    aria-pressed={defaultCurrency === currency}
                    onClick={() => onDefaultCurrencyChange(currency)}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>

            <form
              ref={composerRef}
              className="nl-composer surface-secondary"
              onSubmit={handleSubmit}
              data-action="quick-entry-submit"
            >
              <label className="nl-composer__field">
                <span className="sr-only">输入开销</span>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder="用一句话记下开销…"
                  rows={3}
                  autoComplete="off"
                />
              </label>
              <div className="nl-composer__actions">
                <button
                  type="submit"
                  className="nl-composer__submit"
                  disabled={!previews.length || isParsing}
                >
                  {isParsing ? "解析中…" : "生成记账预览"}
                </button>
              </div>
            </form>

            <div className="nl-suggest" aria-label="快捷模板">
              <span className="nl-suggest__label">快捷模板</span>
              <div className="nl-suggest__chips">
                {visibleTemplates.map((template) => (
                  <button
                    key={template}
                    type="button"
                    className="nl-chip"
                    onClick={() => applyTemplate(template)}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {previews.length > 0 ? (
              <p className="nl-hint" role="status">
                已识别 {previews.length} 笔 · Enter 生成预览
              </p>
            ) : error ? (
              <p className="nl-error">{error}</p>
            ) : null}
          </div>
        ) : (
          <div className="nl-thread" role="log" aria-live="polite">
            <div className="nl-thread__row nl-thread__row--user">
              <div className="nl-bubble nl-bubble--user surface-secondary">
                <p>{bubbleText || "（已生成预览）"}</p>
                <button
                  type="button"
                  className="ghost-button nl-bubble__edit"
                  data-action="preview-edit-input"
                  onClick={handleEditPreview}
                >
                  修改语句
                </button>
              </div>
            </div>

            <div className="nl-thread__row nl-thread__row--assistant">
              <div className="nl-bubble nl-bubble--assistant surface-secondary">
                <header className="nl-bubble__header">
                  <h3>识别结果</h3>
                  <button
                    type="button"
                    className="ghost-button"
                    data-action="preview-add-record"
                    onClick={onPreviewAdd}
                  >
                    补一笔
                  </button>
                </header>

                <div className="nl-preview-table-wrap">
                  <table className="nl-preview-table">
                    <thead>
                      <tr>
                        <th scope="col">日期</th>
                        <th scope="col">分类</th>
                        <th scope="col">金额</th>
                        <th scope="col">货币</th>
                        <th scope="col">备注</th>
                        <th scope="col">
                          <span className="sr-only">操作</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRecords.map((preview, index) => (
                        <tr key={`${preview.date}-${preview.amount}-${preview.note}-${index}`}>
                          <td>
                            <input
                              type="date"
                              aria-label={`第 ${index + 1} 笔日期`}
                              value={preview.date}
                              onChange={(event) =>
                                onPreviewChange(index, "date", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`第 ${index + 1} 笔分类`}
                              value={preview.category}
                              onChange={(event) =>
                                onPreviewChange(index, "category", event.target.value)
                              }
                            >
                              {categories.map((category) => (
                                <option key={category} value={category}>
                                  {category}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              inputMode="decimal"
                              aria-label={`第 ${index + 1} 笔金额`}
                              value={preview.amount}
                              onChange={(event) =>
                                onPreviewChange(index, "amount", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              aria-label={`第 ${index + 1} 笔货币`}
                              value={preview.currency}
                              onChange={(event) =>
                                onPreviewChange(index, "currency", event.target.value)
                              }
                            >
                              {currencies.map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="nl-preview-table__note">
                            <input
                              aria-label={`第 ${index + 1} 笔备注`}
                              value={preview.note}
                              onChange={(event) =>
                                onPreviewChange(index, "note", event.target.value)
                              }
                            />
                          </td>
                          <td className="nl-preview-table__actions">
                            <button
                              type="button"
                              className="delete-record-button"
                              data-action="preview-delete-record"
                              onClick={() => onPreviewDelete(index)}
                              aria-label="删除预览记录"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewRecords.some((_, index) => previewIssues[index]?.length) ? (
                    <div className="nl-preview-table__issues">
                      {previewRecords.map((preview, index) =>
                        previewIssues[index]?.length ? (
                          <p key={`issue-${index}`}>
                            第 {index + 1} 笔（{preview.category || "未分类"}）：
                            {previewIssues[index].join(" / ")}
                          </p>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </div>

                {warnings.length ? (
                  <div className="nl-preview-warnings">
                    {warnings.map((warning) => (
                      <small key={warning}>{warning}</small>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="nl-thread__actions">
              <button
                type="button"
                className="secondary-button"
                data-action="preview-cancel-import"
                onClick={handleCancel}
              >
                取消记账
              </button>
              <button
                type="button"
                className="nl-confirm-primary"
                data-action="preview-confirm-import"
                disabled={!canConfirm}
                onClick={onConfirm}
              >
                完成记账
              </button>
            </div>
          </div>
        )}

        {statusMessage ? <p className="status nl-status">{statusMessage}</p> : null}
      </section>

      {compactVisible && !previewMode ? (
        <div className="nl-compact-entry-host">
          <form
            className="nl-compact-entry surface-secondary"
            onSubmit={handleSubmit}
            data-action="compact-quick-entry-submit"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入一笔，Enter 确认"
              aria-label="底部快速记账输入"
            />
            <button
              type="submit"
              disabled={!previews.length || isParsing}
              aria-label="生成记账预览"
            >
              →
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
