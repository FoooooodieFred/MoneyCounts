import { FormEvent, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { parseQuickExpenseLines, type QuickExpenseResult } from "../lib/quickExpenseParser";
import type { LocalLedgerRecord } from "../lib/localLedgerParser";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import { formatElapsedMs } from "../lib/moneyMoreAgent";
import { IconPen, IconSend } from "./MoneyMoreIcons";
import { BloubAvatar } from "./BloubAvatar";
import { RoseFourLoader } from "./RoseFourLoader";
import {
  LEDGER_PARSE_MODE_OPTIONS,
  ledgerParseModeLabel,
  readLedgerParseMode,
  saveLedgerParseMode,
  type LedgerParseMode,
} from "../lib/ledgerParseMode";

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

type SheetRect = { left: number; top: number; width: number; height: number };

const captureSheetRect = (node: HTMLElement | null): SheetRect | null => {
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
};

const playComposerToUserBubbleMorph = (
  bubble: HTMLElement,
  thread: HTMLElement,
  from: SheetRect,
) => {
  const to = bubble.getBoundingClientRect();
  if (to.width < 1 || to.height < 1) return undefined;
  const assistant = thread.querySelector<HTMLElement>(".nl-thread__row--assistant");
  const actions = thread.querySelector<HTMLElement>(".nl-thread__actions");
  const rest = [assistant, actions].filter((node): node is HTMLElement => Boolean(node));
  const edit = bubble.querySelector<HTMLElement>(".nl-bubble__edit");
  const text = bubble.querySelector("p")?.textContent ?? "";
  gsap.killTweensOf([bubble, thread, ...rest, edit].filter(Boolean));
  bubble.classList.add("is-morphing");
  thread.classList.add("is-morphing");

  const restHeights = rest.map((node) => node.getBoundingClientRect().height);
  const threadGap =
    Number.parseFloat(getComputedStyle(thread).rowGap || getComputedStyle(thread).gap) || 16;

  const ghost = document.createElement("div");
  ghost.className = "nl-morph-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const ghostText = document.createElement("p");
  ghostText.textContent = text;
  ghost.appendChild(ghostText);
  document.body.appendChild(ghost);

  const bubbleStyle = getComputedStyle(bubble);
  const fromRadius =
    getComputedStyle(document.documentElement).getPropertyValue("--radius").trim() || "24px";

  gsap.set(ghost, {
    left: from.left,
    top: from.top,
    width: from.width,
    height: from.height,
    borderRadius: fromRadius,
  });
  gsap.set(bubble, { autoAlpha: 0 });
  if (edit) gsap.set(edit, { autoAlpha: 0 });
  gsap.set(thread, { gap: 0 });
  rest.forEach((node) => {
    gsap.set(node, { height: 0, autoAlpha: 0, overflow: "hidden", boxSizing: "border-box" });
  });

  const cleanup = () => {
    gsap.killTweensOf(ghost);
    ghost.remove();
    bubble.classList.remove("is-morphing");
    thread.classList.remove("is-morphing");
    gsap.set(bubble, { clearProps: "opacity,visibility" });
    gsap.set(thread, { clearProps: "gap" });
    gsap.set(rest, { clearProps: "height,overflow,opacity,visibility,boxSizing" });
    if (edit) gsap.set(edit, { clearProps: "opacity,visibility" });
  };

  const timeline = gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: cleanup,
  });
  timeline.to(
    ghost,
    {
      left: to.left,
      top: to.top,
      width: to.width,
      height: to.height,
      borderRadius: bubbleStyle.borderRadius,
      backgroundColor: bubbleStyle.backgroundColor,
      duration: 0.9,
      ease: "power2.out",
    },
    0,
  );
  timeline.to(ghostText, { autoAlpha: 0, duration: 0.36, ease: "power1.out" }, 0.08);
  timeline.to(ghost, { autoAlpha: 0, duration: 0.22, ease: "power1.out" }, 0.7);
  timeline.to(bubble, { autoAlpha: 1, duration: 0.28, ease: "power1.out" }, 0.66);
  rest.forEach((node, index) => {
    timeline.to(
      node,
      {
        height: restHeights[index],
        autoAlpha: 1,
        duration: 0.55,
        ease: "power2.out",
      },
      0.58 + index * 0.08,
    );
  });
  timeline.to(thread, { gap: threadGap, duration: 0.5, ease: "power2.out" }, 0.58);
  if (edit) {
    timeline.to(edit, { autoAlpha: 1, duration: 0.24, ease: "power1.out" }, 0.84);
  }

  return () => {
    timeline.kill();
    cleanup();
  };
};

function ParseModeSwitch({
  parseMode,
  disabled,
  onSelect,
}: {
  parseMode: LedgerParseMode;
  disabled: boolean;
  onSelect: (mode: LedgerParseMode) => void;
}) {
  return (
    <div
      className="nl-parse-switch nl-pill-switch"
      role="radiogroup"
      aria-label="记账方式"
      data-selected={parseMode}
    >
      {LEDGER_PARSE_MODE_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          className={`nl-parse-switch__option${parseMode === option.id ? " active" : ""}`}
          aria-checked={parseMode === option.id}
          aria-label={ledgerParseModeLabel(option.id)}
          disabled={disabled}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type NaturalLanguageInputProps = {
  defaultCurrency: "CNY" | "HKD";
  categories: readonly string[];
  currencies: readonly string[];
  onDefaultCurrencyChange: (currency: "CNY" | "HKD") => void;
  onSubmit: (results: QuickExpenseResult[], rawInput: string, parseMode: LedgerParseMode) => void;
  apiConfigured?: boolean;
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
  apiConfigured = false,
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
  const threadRef = useRef<HTMLDivElement | null>(null);
  const userBubbleRef = useRef<HTMLDivElement | null>(null);
  const morphFromRef = useRef<SheetRect | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCompactScrollRef = useRef(false);
  const [input, setInput] = useState("");
  const [previews, setPreviews] = useState<QuickExpenseResult[]>([]);
  const [error, setError] = useState("");
  const [compactVisible, setCompactVisible] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [parseMode, setParseMode] = useState<LedgerParseMode>(() => readLedgerParseMode());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sheetView, setSheetView] = useState<"idle" | "thread">(
    previewRecords.length > 0 ? "thread" : "idle",
  );

  const previewMode = previewRecords.length > 0;
  const isMoneyMore = parseMode === "llm";
  const bubbleText = submittedInput.trim() || input.trim();
  const canSubmit =
    !isParsing && (parseMode === "llm" ? Boolean(input.trim()) : Boolean(previews.length));
  const llmWaiting = isParsing && parseMode === "llm";
  const composerClassName = [
    "nl-composer",
    "surface-secondary",
    isMoneyMore ? "nl-composer--mm" : "",
    llmWaiting ? "is-parsing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    if (!input.trim()) {
      setPreviews([]);
      setError("");
      onClearStatus();
      return;
    }
    const parsed = parseQuickExpenseLines(input, defaultCurrency);
    setPreviews(parsed);
    setError(parseMode === "llm" || parsed.length ? "" : "需包含金额，例如「午餐 45 港币」");
  }, [input, defaultCurrency, onClearStatus, parseMode]);

  useEffect(() => {
    if (!llmWaiting) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [llmWaiting]);

  useLayoutEffect(() => {
    if (previewMode && sheetView === "idle") {
      morphFromRef.current = captureSheetRect(composerRef.current);
      setSheetView("thread");
      return;
    }
    if (!previewMode && sheetView === "thread") {
      morphFromRef.current = null;
      setSheetView("idle");
      return;
    }
    if (sheetView !== "thread") return;
    const thread = threadRef.current;
    const bubble = userBubbleRef.current;
    const from = morphFromRef.current;
    morphFromRef.current = null;
    if (!thread || !bubble) return;
    if (!from || prefersReducedMotion()) return;
    return playComposerToUserBubbleMorph(bubble, thread, from);
  }, [previewMode, sheetView]);

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
    if (parseMode === "llm") {
      if (!rawInput.trim()) {
        setError("请先输入要记账的内容");
        return;
      }
      onSubmit(previews, rawInput, parseMode);
      setError("");
    } else {
      const parsed = parseQuickExpenseLines(rawInput, defaultCurrency);
      if (!parsed.length) {
        setError("无法解析，请检查是否包含金额");
        return;
      }
      onSubmit(parsed, rawInput, parseMode);
      setError("");
    }
    if (fromCompact) {
      pendingCompactScrollRef.current = true;
    }
  };

  const selectParseMode = (mode: LedgerParseMode) => {
    if (isParsing) return;
    setParseMode(mode);
    saveLedgerParseMode(mode);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing)
      return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
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

  const handleEditPreview = () => {
    if (submittedInput.trim()) setInput(submittedInput);
    onCancel();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCancel = () => {
    onCancel();
    setError("");
  };

  const previewTable = (
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
                  onChange={(event) => onPreviewChange(index, "date", event.target.value)}
                />
              </td>
              <td>
                <select
                  aria-label={`第 ${index + 1} 笔分类`}
                  value={preview.category}
                  onChange={(event) => onPreviewChange(index, "category", event.target.value)}
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
                  onChange={(event) => onPreviewChange(index, "amount", event.target.value)}
                />
              </td>
              <td>
                <select
                  aria-label={`第 ${index + 1} 笔货币`}
                  value={preview.currency}
                  onChange={(event) => onPreviewChange(index, "currency", event.target.value)}
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
                  onChange={(event) => onPreviewChange(index, "note", event.target.value)}
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
  );

  return (
    <>
      <section
        ref={sectionRef}
        className={`nl-section is-visible${sheetView === "thread" ? " is-thread" : " is-idle"}${isMoneyMore ? " nl-section--mm" : ""}`}
        id="entry"
        data-section="quick-entry"
      >
        {sheetView !== "thread" ? (
          <div className={`nl-idle${isMoneyMore ? " nl-idle--mm" : ""}`}>
            <div className="nl-idle__bar">
              <div className="nl-idle__identity">
                {isMoneyMore ? (
                  <BloubAvatar size={40} mood={llmWaiting ? "loading" : "idle"} decorative />
                ) : null}
                <h2 className="nl-idle__title">{isMoneyMore ? "MoneyMore" : "记一笔"}</h2>
              </div>
              <div className="nl-idle__toggles">
                <ParseModeSwitch
                  parseMode={parseMode}
                  disabled={isParsing}
                  onSelect={selectParseMode}
                />
                <div
                  className="nl-currency-toggle nl-pill-switch"
                  role="group"
                  aria-label="默认货币"
                  data-selected={defaultCurrency}
                >
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
            </div>

            <form
              ref={composerRef}
              className={composerClassName}
              onSubmit={handleSubmit}
              data-action="quick-entry-submit"
              aria-busy={llmWaiting}
            >
              {isMoneyMore ? (
                <span className="nl-composer__orbit" aria-hidden="true">
                  <span className="nl-composer__orbit-spin" />
                </span>
              ) : null}
              <label className="nl-composer__field">
                <span className="sr-only">输入开销</span>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder={
                    isMoneyMore ? "问账本，或直接说今天午餐 45 港币" : "用一句话记下开销…"
                  }
                  rows={3}
                  autoComplete="off"
                  readOnly={llmWaiting}
                />
              </label>
              {llmWaiting ? (
                <div className="nl-composer__loader">
                  <RoseFourLoader
                    label="正在生成记账预览"
                    elapsedLabel={formatElapsedMs(elapsedMs)}
                  />
                </div>
              ) : null}
              <div className="nl-composer__actions">
                {isMoneyMore ? (
                  <button
                    type="submit"
                    className="moneymore-orb-btn"
                    disabled={!canSubmit}
                    aria-label="发送"
                    title="发送"
                  >
                    <span className="moneymore-orb-btn__icon" data-active="true">
                      <IconSend />
                    </span>
                  </button>
                ) : (
                  <button type="submit" className="nl-composer__submit" disabled={!canSubmit}>
                    {isParsing ? "解析中…" : "生成记账预览"}
                  </button>
                )}
              </div>
            </form>

            {!apiConfigured ? (
              <p className="nl-hint" role="status">
                接入 API 后可召唤 MoneyMore。请先到{" "}
                <Link className="nl-hint__link" to="/console">
                  API 看台
                </Link>{" "}
                填写接口与密钥。
              </p>
            ) : !isMoneyMore ? (
              <p className="nl-hint" role="status">
                当前用本地规则识别。换成 AI 后，这里会变成 MoneyMore。
              </p>
            ) : null}
            {error ? <p className="nl-error">{error}</p> : null}
          </div>
        ) : (
          <div
            className={`nl-thread${isMoneyMore ? " nl-thread--mm" : ""}`}
            ref={threadRef}
            role="log"
            aria-live="polite"
          >
            <div className="nl-thread__row nl-thread__row--user">
              <div
                className={`nl-bubble nl-bubble--user${isMoneyMore ? "" : " surface-secondary"}`}
                ref={userBubbleRef}
              >
                {isMoneyMore ? <span className="moneymore-bubble-msg__who">我</span> : null}
                <p>{bubbleText || "（已生成预览）"}</p>
                <button
                  type="button"
                  className="nl-bubble__edit"
                  data-action="preview-edit-input"
                  aria-label="修改语句"
                  title="修改语句"
                  onClick={handleEditPreview}
                >
                  <IconPen />
                </button>
              </div>
            </div>

            <div className="nl-thread__row nl-thread__row--assistant">
              {isMoneyMore ? <BloubAvatar size={32} mood="idle" decorative /> : null}
              <div
                className={`nl-bubble nl-bubble--assistant${isMoneyMore ? "" : " surface-secondary"}`}
              >
                <header className="nl-bubble__header">
                  <div>
                    {isMoneyMore ? (
                      <span className="moneymore-bubble-msg__who">MoneyMore</span>
                    ) : null}
                    <h3>{isMoneyMore ? "待确认记账" : "识别结果"}</h3>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    data-action="preview-add-record"
                    onClick={onPreviewAdd}
                  >
                    手动记一笔
                  </button>
                </header>

                {previewTable}

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
                {isMoneyMore ? "取消" : "取消记账"}
              </button>
              <button
                type="button"
                className="nl-confirm-primary"
                data-action="preview-confirm-import"
                disabled={!canConfirm}
                onClick={onConfirm}
              >
                {isMoneyMore ? "确认记账" : "完成记账"}
              </button>
            </div>
          </div>
        )}

        {statusMessage && sheetView !== "thread" ? (
          <p className="status nl-status">{statusMessage}</p>
        ) : null}
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
            <button type="submit" disabled={!canSubmit} aria-label="生成记账预览">
              →
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
