import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { parseQuickExpenseLines, type QuickExpenseResult } from "../lib/quickExpenseParser";
import type { LocalLedgerRecord } from "../lib/localLedgerParser";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCompactScrollRef = useRef(false);
  const [input, setInput] = useState("");
  const [previews, setPreviews] = useState<QuickExpenseResult[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [compactVisible, setCompactVisible] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const previewMode = previewRecords.length > 0;
  const bubbleText = submittedInput.trim() || input.trim();

  useGsapContext(
    sectionRef,
    (_ctx) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (prefersReducedMotion()) {
        gsap.set(dialog, { clearProps: "opacity,visibility,transform" });
        return;
      }
      gsap.fromTo(
        dialog,
        { autoAlpha: 0, y: 16 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.45,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    },
    [],
  );

  useGsapContext(
    previewRef,
    (ctx) => {
      if (!previewMode || prefersReducedMotion()) return;
      gsap.fromTo(
        ctx.selector?.(".nl-preview-row") ?? [],
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          stagger: 0.04,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "transform,opacity,visibility",
        },
      );
    },
    [previewMode, previewRecords.length],
  );

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
      if (!section) return;
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
  }, []);

  useEffect(() => {
    if (!resetSignal) return;
    setInput("");
    setPreviews([]);
    setExpanded(false);
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
    setExpanded(true);
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
    setExpanded(true);
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

    setExpanded(true);

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
        className={`nl-section is-visible${expanded ? " is-expanded" : ""}${previewMode ? " is-preview" : ""}`}
        id="entry"
        data-section="quick-entry"
      >
        <div ref={dialogRef} className="nl-dialog nl-dialog--composer">
          <header className="nl-dialog__header nl-dialog__header--compact">
            <div>
              <h2>记一笔</h2>
            </div>
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
          </header>

          {!previewMode ? (
            <>
              <form
                className="nl-form nl-form--bubble"
                onSubmit={handleSubmit}
                data-action="quick-entry-submit"
              >
                <div className="nl-bubble">
                  <label className="nl-bubble__field">
                    <span className="sr-only">输入开销</span>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onFocus={() => setExpanded(true)}
                      onKeyDown={handleKeyDown}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      placeholder="用一句话记下开销…"
                      rows={expanded ? 4 : 3}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="submit"
                    className="nl-bubble__action"
                    disabled={!previews.length || isParsing}
                  >
                    {isParsing ? "解析中…" : "生成记账预览"}
                  </button>
                </div>
              </form>

              <div className="nl-template-stack" aria-label="快捷模板">
                <p className="nl-template-stack__hint">快捷模板 · 点选填入后再补金额</p>
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

              {previews.length > 0 ? (
                <div className="nl-preview nl-preview--compact" role="status">
                  <span className="nl-preview__count">
                    草稿识别 {previews.length} 笔，点「生成记账预览」继续
                  </span>
                </div>
              ) : error ? (
                <p className="nl-error">{error}</p>
              ) : null}
            </>
          ) : (
            <>
              <div className="nl-message-row">
                <div className="nl-message-bubble" aria-label="已输入内容">
                  <p>{bubbleText || "（已生成预览）"}</p>
                </div>
                <button
                  type="button"
                  className="secondary-button nl-edit-preview"
                  data-action="preview-edit-input"
                  onClick={handleEditPreview}
                >
                  更改记账预览
                </button>
              </div>

              <div ref={previewRef} className="nl-preview nl-preview--batch" role="status">
                <div className="nl-preview__heading">
                  <span className="nl-preview__count">记账预览 · 可编辑 · {previewRecords.length} 笔</span>
                  <button
                    type="button"
                    className="ghost-button"
                    data-action="preview-add-record"
                    onClick={onPreviewAdd}
                  >
                    补一笔
                  </button>
                </div>
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
                {warnings.length ? (
                  <div className="nl-preview-warnings">
                    {warnings.map((warning) => (
                      <small key={warning}>{warning}</small>
                    ))}
                  </div>
                ) : null}
                <div className="nl-preview__footer">
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
            </>
          )}

          {statusMessage ? <p className="status nl-status">{statusMessage}</p> : null}
        </div>
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
