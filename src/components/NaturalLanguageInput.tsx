import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { parseQuickExpenseLines, type QuickExpenseResult } from "../lib/quickExpenseParser";
import type { LocalLedgerRecord } from "../lib/localLedgerParser";
import { prefersReducedMotion } from "../hooks/useGsapContext";

function resolveEntryScrollTarget(section: HTMLElement | null) {
  return (
    section ??
    document.getElementById("entry") ??
    document.querySelector<HTMLElement>('[data-section="quick-entry-slot"]')
  );
}

function focusTextareaAfterScroll(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  const focus = () => textarea.focus({ preventScroll: true });
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

const QUICK_TEMPLATES = [
  "这一周每天地铁来回 __ HKD",
  "午餐 __ 元",
  "朋友还我 __",
  "大前天奶茶 __ 块",
  "发工资 __",
];

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
  const dockRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const flipFromRef = useRef<DOMRect | null>(null);
  const pendingCompactScrollRef = useRef(false);
  const [input, setInput] = useState("");
  const [previews, setPreviews] = useState<QuickExpenseResult[]>([]);
  const [error, setError] = useState("");
  const [compactVisible, setCompactVisible] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

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
    flipFromRef.current = null;
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

  useLayoutEffect(() => {
    if (!previewMode) return;
    const dock = dockRef.current;
    const answer = previewRef.current;
    if (!dock) return;

    const from = flipFromRef.current;
    flipFromRef.current = null;

    if (prefersReducedMotion()) {
      gsap.set([dock, answer].filter(Boolean), { clearProps: "all" });
      return;
    }

    if (from) {
      const to = dock.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const sx = Math.max(0.35, from.width / Math.max(to.width, 1));
      const sy = Math.max(0.35, from.height / Math.max(to.height, 1));
      gsap.fromTo(
        dock,
        {
          x: dx,
          y: dy,
          scaleX: sx,
          scaleY: sy,
          transformOrigin: "top left",
          autoAlpha: 0.92,
        },
        {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          autoAlpha: 1,
          duration: 0.58,
          ease: "power3.inOut",
          clearProps: "transform",
        },
      );
    } else {
      gsap.fromTo(
        dock,
        { autoAlpha: 0, y: -12, x: 18 },
        { autoAlpha: 1, y: 0, x: 0, duration: 0.4, ease: "power2.out" },
      );
    }

    if (answer) {
      gsap.fromTo(
        answer,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.42,
          delay: 0.12,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    }
  }, [previewMode]);

  const captureComposerFlip = () => {
    if (composerRef.current) {
      flipFromRef.current = composerRef.current.getBoundingClientRect();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fromCompact = event.currentTarget.classList.contains("nl-compact-entry");
    const rawInput = input;
    const parsed = parseQuickExpenseLines(rawInput, defaultCurrency);
    if (!parsed.length) {
      setError("无法解析，请检查是否包含金额");
      return;
    }
    if (!fromCompact) captureComposerFlip();
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

  const focusMainInput = () => {
    sectionRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "center",
    });
    requestAnimationFrame(() => textareaRef.current?.focus());
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
    setInput((current) => {
      const trimmed = current.trim();
      return trimmed ? `${trimmed}\n${template}` : template;
    });
    focusMainInput();
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
        {previewMode
          ? createPortal(
              <aside ref={dockRef} className="nl-query-dock" aria-label="已提交的记账语句">
                <p className="nl-query-dock__text">{bubbleText || "（已生成预览）"}</p>
                <button
                  type="button"
                  className="ghost-button nl-query-dock__edit"
                  data-action="preview-edit-input"
                  onClick={handleEditPreview}
                >
                  更改记账预览
                </button>
              </aside>,
              document.body,
            )
          : null}

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
              className="nl-composer"
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
                {QUICK_TEMPLATES.map((template) => (
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
          <div ref={previewRef} className="nl-answer" role="status">
            <header className="nl-answer__header">
              <div>
                <p className="eyebrow">Preview</p>
                <h3>记账预览</h3>
                <p className="muted">可直接改日期、分类、金额；确认后写入账本。</p>
              </div>
              <button
                type="button"
                className="ghost-button"
                data-action="preview-add-record"
                onClick={onPreviewAdd}
              >
                补一笔
              </button>
            </header>

            <div className="nl-answer__table">
              {previewRecords.map((preview, index) => (
                <div
                  key={`${preview.date}-${preview.amount}-${preview.note}-${index}`}
                  className="nl-preview-row nl-preview-row--editable"
                >
                  <label>
                    日期
                    <input
                      type="date"
                      value={preview.date}
                      onChange={(event) => onPreviewChange(index, "date", event.target.value)}
                    />
                  </label>
                  <label>
                    分类
                    <select
                      value={preview.category}
                      onChange={(event) => onPreviewChange(index, "category", event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    金额
                    <input
                      inputMode="decimal"
                      value={preview.amount}
                      onChange={(event) => onPreviewChange(index, "amount", event.target.value)}
                    />
                  </label>
                  <label>
                    货币
                    <select
                      value={preview.currency}
                      onChange={(event) => onPreviewChange(index, "currency", event.target.value)}
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nl-preview-row__note">
                    备注
                    <input
                      value={preview.note}
                      onChange={(event) => onPreviewChange(index, "note", event.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="delete-record-button"
                    data-action="preview-delete-record"
                    onClick={() => onPreviewDelete(index)}
                    aria-label="删除预览记录"
                  >
                    ×
                  </button>
                  {previewIssues[index]?.length ? (
                    <small className="nl-preview-row__issues">
                      {previewIssues[index].join(" / ")}
                    </small>
                  ) : null}
                </div>
              ))}
            </div>

            {warnings.length ? (
              <div className="nl-preview-warnings">
                {warnings.map((warning) => (
                  <small key={warning}>{warning}</small>
                ))}
              </div>
            ) : null}

            <div className="nl-answer__footer">
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
            className="nl-compact-entry"
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
