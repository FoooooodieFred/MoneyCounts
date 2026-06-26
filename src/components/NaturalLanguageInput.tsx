import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  parseQuickExpenseLines,
  type QuickExpenseResult,
} from "../lib/quickExpenseParser";
import type { LocalLedgerRecord } from "../localLedgerParser";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

function resolveEntryScrollTarget(section: HTMLElement | null) {
  return (
    section
    ?? document.getElementById("entry")
    ?? document.querySelector<HTMLElement>('[data-section="quick-entry-slot"]')
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
  onClearStatus: () => void;
  onPreviewChange: (index: number, field: keyof Pick<LocalLedgerRecord, "date" | "category" | "amount" | "currency" | "note">, value: string) => void;
  onPreviewDelete: (index: number) => void;
  onPreviewAdd: () => void;
  previewRecords: LocalLedgerRecord[];
  previewIssues: string[][];
  warnings: string[];
  canConfirm: boolean;
  isParsing?: boolean;
  resetSignal?: number;
  statusMessage?: string;
};

const QUICK_TEMPLATES = [
  "这一周每天地铁来回10.8HKD",
  "今天明天都要洗衣服花10HKD",
  "大前天奶茶20块",
  "朋友还我100",
  "午餐45HKD，地铁10.8HKD",
  "发工资 5000",
];

export function NaturalLanguageInput({
  defaultCurrency,
  categories,
  currencies,
  onDefaultCurrencyChange,
  onSubmit,
  onConfirm,
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

  useGsapContext(sectionRef, (ctx) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (prefersReducedMotion()) {
      gsap.set(dialog, { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.fromTo(
      dialog,
      { autoAlpha: 0, scale: 0.97, y: 20 },
      {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      },
    );
  }, []);

  useGsapContext(previewRef, (ctx) => {
    if (!previews.length || prefersReducedMotion()) return;
    gsap.fromTo(
      ctx.selector?.(".nl-preview-row") ?? [],
      { autoAlpha: 0, x: -8 },
      {
        autoAlpha: 1,
        x: 0,
        stagger: 0.05,
        duration: 0.3,
        ease: "power2.out",
        clearProps: "transform,opacity,visibility",
      },
    );
  }, [previews.length]);

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

  const handleFocus = () => {
    setExpanded(true);
    if (prefersReducedMotion() || !dialogRef.current) return;
    gsap.to(dialogRef.current, { scale: 1.01, duration: 0.35, ease: "power2.out" });
  };

  const handleBlur = () => {
    if (prefersReducedMotion() || !dialogRef.current) return;
    gsap.to(dialogRef.current, { scale: 1, duration: 0.35, ease: "power2.out" });
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
    onSubmit(parsed, rawInput);
    setError("");
    setExpanded(true);
    if (fromCompact) {
      pendingCompactScrollRef.current = true;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  const focusMainInput = () => {
    setExpanded(true);
    sectionRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
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

  return (
    <>
      <section ref={sectionRef} className={`nl-section is-visible${expanded ? " is-expanded" : ""}`} id="entry" data-section="quick-entry">
        <div ref={dialogRef} className="nl-dialog">
          <div className="nl-dialog__glow" aria-hidden="true" />
          <header className="nl-dialog__header">
            <div>
              <p className="eyebrow">Quick Entry</p>
              <h2>几句话记几笔</h2>
              <p className="muted">支持多句混输、相对日期、多币种、AA/退款/到账；按 Enter 确认，Shift+Enter 换行。</p>
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

          <div className="nl-template-row" aria-label="快捷模板">
            {QUICK_TEMPLATES.map((template) => (
              <button key={template} type="button" onClick={() => applyTemplate(template)}>
                {template}
              </button>
            ))}
          </div>

          <form className="nl-form" onSubmit={handleSubmit} data-action="quick-entry-submit">
            <label className="nl-input-wrap">
              <span className="sr-only">输入今日开销</span>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="例如：大前天奶茶20块；朋友还我100；今天明天洗衣服10HKD"
                rows={expanded ? 5 : 3}
                autoComplete="off"
              />
            </label>
            <div className="nl-form__actions">
              <button type="submit" disabled={!previews.length || isParsing}>
                {isParsing ? "解析中..." : `生成预览${previews.length > 1 ? ` (${previews.length} 笔)` : ""}`}
              </button>
              <button type="button" className="secondary-button" data-action="quick-entry-clear" onClick={() => setInput("")}>
                清空
              </button>
            </div>
          </form>

          {previewRecords.length > 0 ? (
            <div ref={previewRef} className="nl-preview nl-preview--batch" role="status">
              <div className="nl-preview__heading">
                <span className="nl-preview__count">待确认 {previewRecords.length} 笔</span>
                <button type="button" className="ghost-button" data-action="preview-add-record" onClick={onPreviewAdd}>
                  补一笔
                </button>
              </div>
              {previewRecords.map((preview, index) => (
                <div key={`${preview.date}-${preview.amount}-${preview.note}-${index}`} className="nl-preview-row nl-preview-row--editable">
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
                    <select value={preview.category} onChange={(event) => onPreviewChange(index, "category", event.target.value)}>
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
                    <select value={preview.currency} onChange={(event) => onPreviewChange(index, "currency", event.target.value)}>
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="nl-preview-row__note">
                    备注
                    <input value={preview.note} onChange={(event) => onPreviewChange(index, "note", event.target.value)} />
                  </label>
                  <button type="button" className="delete-record-button" data-action="preview-delete-record" onClick={() => onPreviewDelete(index)} aria-label="删除预览记录">
                    ×
                  </button>
                  {previewIssues[index]?.length ? (
                    <small className="nl-preview-row__issues">{previewIssues[index].join(" / ")}</small>
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
              <button type="button" className="nl-confirm-float" data-action="preview-confirm-import" disabled={!canConfirm} onClick={onConfirm}>
                确认记账
              </button>
            </div>
          ) : previews.length > 0 ? (
            <div ref={previewRef} className="nl-preview nl-preview--compact" role="status">
              <span className="nl-preview__count">草稿识别 {previews.length} 笔，按 Enter 生成可编辑预览</span>
              {previews.map((preview, index) => (
                <div key={`${preview.amount}-${preview.note}-${index}`} className="nl-preview-row">
                  <span>{preview.category}</span>
                  <strong>{preview.amount} {preview.currency}</strong>
                  {preview.note ? <em>{preview.note}</em> : null}
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="nl-error">{error}</p>
          ) : null}

          {statusMessage ? <p className="status nl-status">{statusMessage}</p> : null}
        </div>
      </section>

      {compactVisible ? (
        <div className="nl-compact-entry-host">
          <form className="nl-compact-entry" onSubmit={handleSubmit} data-action="compact-quick-entry-submit">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入一笔，Enter 确认"
              aria-label="底部快速记账输入"
            />
            <button type="submit" disabled={!previews.length || isParsing} aria-label="生成记账预览">
              →
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
