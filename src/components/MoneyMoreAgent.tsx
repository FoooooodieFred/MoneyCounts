import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ChatMarkdown } from "./ChatMarkdown";
import {
  IconMaximize,
  IconPen,
  IconRestore,
  IconSend,
  IconShrink,
  IconStop,
} from "./MoneyMoreIcons";
import { MoneyMoreStatCards } from "./MoneyMoreStatCards";
import { BloubAvatar } from "./BloubAvatar";
import { RoseFourLoader } from "./RoseFourLoader";
import { formatElapsedMs, runMoneyMoreTurn } from "../lib/moneyMoreAgent";
import { stripHiddenThink } from "../lib/chatDisplay";
import type { MoneyMoreCard } from "../lib/moneyMoreCards";
import {
  measureHostGutters,
  moneyMoreContentBox,
  moneyMoreFrame,
  readSurfaceColor,
  type MoneyMoreSize,
} from "../lib/moneyMoreMotion";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import type { LlmApiSettings } from "../lib/llmApiSettings";
import type { LlmChatMessage } from "../lib/llmProxy";
import type { MoneyMoreLedgerDraft, MoneyMoreToolContext } from "../lib/moneyMoreTools";

export type { MoneyMoreSize };

export type VisibleChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards?: MoneyMoreCard[];
  createdAt: number;
};

type MoneyMoreAgentProps = {
  settings: LlmApiSettings;
  context: Omit<MoneyMoreToolContext, "onStageDraft">;
  draft: MoneyMoreLedgerDraft | null;
  onStageDraft: (draft: MoneyMoreLedgerDraft) => void;
  onConfirmDraft: () => void;
  onCancelDraft: () => void;
  formatMoney: (amount: number, currency: string) => string;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mm-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const fallbackMoney = (amount: number, currency: string) =>
  `${amount.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

export function MoneyMoreAgent({
  settings,
  context,
  draft,
  onStageDraft,
  onConfirmDraft,
  onCancelDraft,
  formatMoney = fallbackMoney,
}: MoneyMoreAgentProps) {
  const [size, setSize] = useState<MoneyMoreSize>("bubble");
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VisibleChatMessage[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: context.canMutateLedger
        ? "我是 **MoneyMore**。可以查账、出统计卡片，也可以在这里对话记账、改账或删账。"
        : "我是 **MoneyMore**。可以查账、出统计卡片，也可以直接在这里对话记账。",
      createdAt: Date.now(),
    },
  ]);
  const historyRef = useRef<LlmChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const chromeRef = useRef<HTMLElement | null>(null);
  const faceRef = useRef<HTMLButtonElement | null>(null);
  const bootedRef = useRef(false);
  const sizeRef = useRef<MoneyMoreSize>(size);
  const lastExpandedRef = useRef({ width: 420, height: 620 });
  const canSend = Boolean(input.trim()) && !busy;

  const toolContext = useMemo(
    () => ({
      ...context,
      onStageDraft: (next: MoneyMoreLedgerDraft) => {
        onStageDraft(next);
        if (next.action === "create") return "已生成预览，等待用户在对话框确认记账。";
        if (next.action === "update") return "已生成改账预览，等待用户确认修改。";
        return "已生成删账预览，等待用户确认删除。";
      },
    }),
    [context, onStageDraft],
  );

  const applyFrame = useCallback((next: MoneyMoreSize, animate: boolean) => {
    const el = shellRef.current;
    const stage = stageRef.current;
    const host = el?.parentElement;
    if (!el || !stage || !host) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const gutters = measureHostGutters(host);
    const surface = readSurfaceColor();
    const frame = moneyMoreFrame(next, viewport, gutters, surface);
    const from = sizeRef.current;
    sizeRef.current = next;
    if (next !== "bubble") {
      lastExpandedRef.current = { width: frame.width, height: frame.height };
    } else if (from === "bubble") {
      lastExpandedRef.current = moneyMoreContentBox("window", viewport, gutters, surface);
    }
    const chrome = chromeRef.current;
    const face = faceRef.current;
    gsap.killTweensOf(el);
    gsap.killTweensOf(stage);
    if (chrome) gsap.killTweensOf(chrome);
    if (face) gsap.killTweensOf(face);
    const geometry = {
      width: frame.width,
      height: frame.height,
      right: frame.right,
      bottom: frame.bottom,
      borderRadius: `${frame.radius}px`,
      overflow: "hidden",
    };
    const stageBox = lastExpandedRef.current;
    const snap = prefersReducedMotion() || !animate;
    const showChrome = next !== "bubble";
    if (snap) {
      gsap.set(el, { ...geometry, backgroundColor: frame.background });
      gsap.set(stage, { width: stageBox.width, height: stageBox.height, x: 0, y: 0 });
      if (chrome) gsap.set(chrome, { opacity: showChrome ? 1 : 0 });
      if (face) gsap.set(face, { opacity: showChrome ? 0 : 1 });
      return;
    }
    if (chrome && showChrome) gsap.set(chrome, { opacity: 1 });
    if (showChrome) gsap.set(el, { backgroundColor: frame.background });
    gsap.set(stage, { width: stageBox.width, height: stageBox.height });
    gsap.to(el, {
      ...geometry,
      duration: next === "bubble" ? 0.52 : from === "bubble" ? 0.78 : 0.7,
      ease: next === "bubble" ? "power3.inOut" : "expo.out",
      overwrite: "auto",
      autoRound: false,
      onComplete: () => {
        if (!showChrome) {
          gsap.set(el, { backgroundColor: frame.background });
          if (chrome) gsap.set(chrome, { opacity: 0 });
        }
        if (showChrome) inputRef.current?.focus();
      },
    });
    if (face) {
      gsap.to(face, {
        opacity: showChrome ? 0 : 1,
        duration: showChrome ? 0.14 : 0.2,
        delay: showChrome ? 0 : 0.26,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  }, []);

  const goSize = useCallback((next: MoneyMoreSize) => {
    setSize((current) => (next === current ? current : next));
  }, []);

  useLayoutEffect(() => {
    const animate = bootedRef.current;
    bootedRef.current = true;
    applyFrame(size, animate);
  }, [applyFrame, size]);

  useEffect(() => {
    const onResize = () => {
      if (size === "bubble") return;
      applyFrame(size, false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyFrame, size]);

  useEffect(
    () => () => {
      gsap.killTweensOf(
        [shellRef.current, stageRef.current, chromeRef.current, faceRef.current].filter(Boolean),
      );
    },
    [],
  );

  useEffect(() => {
    const node = inputRef.current;
    if (!node || size === "bubble") return;
    node.style.height = "auto";
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 40), 120)}px`;
  }, [input, size]);

  useEffect(() => {
    if (size === "bubble") return;
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy, draft, size]);

  useEffect(() => {
    if (!busy) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (size === "full") goSize("window");
      else if (size === "window") goSize("bubble");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goSize, size]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  };

  const sendFrom = async (userText: string, nextVisible: VisibleChatMessage[]) => {
    const text = userText.trim();
    if (!text || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError("");
    setMessages(nextVisible);
    try {
      const result = await runMoneyMoreTurn({
        settings,
        history: historyRef.current,
        userText: text,
        context: toolContext,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      historyRef.current = result.history;
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          text: stripHiddenThink(result.assistantText),
          cards: result.cards,
          createdAt: Date.now(),
        },
      ]);
    } catch (caught) {
      if (
        controller.signal.aborted ||
        (caught instanceof DOMException && caught.name === "AbortError")
      ) {
        setMessages((current) => [
          ...current,
          { id: newId(), role: "assistant", text: "已停止这一轮回复。", createdAt: Date.now() },
        ]);
        return;
      }
      setError(caught instanceof Error ? caught.message : "MoneyMore 暂时无法回复。");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  };

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (editingId) {
      const index = messages.findIndex((item) => item.id === editingId);
      if (index < 0) return;
      const kept = messages.slice(0, index);
      const userTurns = kept.filter((item) => item.role === "user").length;
      let seen = 0;
      const nextHistory: LlmChatMessage[] = [];
      for (const item of historyRef.current) {
        if (item.role === "user") {
          if (seen >= userTurns) break;
          seen += 1;
        }
        nextHistory.push(item);
      }
      historyRef.current = nextHistory;
      const userMessage: VisibleChatMessage = {
        id: newId(),
        role: "user",
        text,
        createdAt: Date.now(),
      };
      setEditingId(null);
      setInput("");
      await sendFrom(text, [...kept, userMessage]);
      return;
    }
    const userMessage: VisibleChatMessage = {
      id: newId(),
      role: "user",
      text,
      createdAt: Date.now(),
    };
    setInput("");
    await sendFrom(text, [...messages, userMessage]);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    void handleSend();
  };

  const startEdit = (message: VisibleChatMessage) => {
    if (message.role !== "user") return;
    stop();
    setEditingId(message.id);
    setInput(message.text);
    if (size === "bubble") goSize("window");
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleOrbClick = (event: FormEvent) => {
    if (!busy) return;
    event.preventDefault();
    stop();
  };

  return (
    <div className={`moneymore-host moneymore-host--${size}`}>
      <div
        ref={shellRef}
        className={`moneymore-shell moneymore-shell--${size}`}
        data-section="moneymore-chat"
      >
        <button
          type="button"
          ref={faceRef}
          className="moneymore-bubble-face"
          data-action="moneymore-open"
          aria-label="打开 MoneyMore"
          title="MoneyMore"
          tabIndex={size === "bubble" ? 0 : -1}
          onClick={() => goSize("window")}
        >
          <BloubAvatar size={58} mood={busy ? "loading" : "idle"} decorative />
        </button>

        <div ref={stageRef} className="moneymore-shell__stage">
          <section
            ref={chromeRef}
            className="moneymore-shell__chrome"
            aria-label="MoneyMore 对话"
            aria-hidden={size === "bubble"}
            inert={size === "bubble" ? true : undefined}
          >
            <header className="moneymore-panel__head">
              <div className="moneymore-panel__identity">
                <BloubAvatar size={36} mood={busy ? "loading" : "idle"} decorative />
                <div>
                  <p className="eyebrow">Agent</p>
                  <h2>MoneyMore</h2>
                </div>
              </div>
              <div className="moneymore-panel__head-actions">
                <button
                  type="button"
                  className="moneymore-icon-btn"
                  data-action="moneymore-shrink"
                  aria-label="缩小窗口"
                  title="缩小窗口"
                  onClick={() => goSize("bubble")}
                >
                  <IconShrink />
                </button>
                {size === "full" ? (
                  <button
                    type="button"
                    className="moneymore-icon-btn"
                    data-action="moneymore-restore"
                    aria-label="还原窗口"
                    title="还原窗口"
                    onClick={() => goSize("window")}
                  >
                    <IconRestore />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="moneymore-icon-btn"
                    data-action="moneymore-maximize"
                    aria-label="最大化窗口"
                    title="最大化窗口"
                    onClick={() => goSize("full")}
                  >
                    <IconMaximize />
                  </button>
                )}
              </div>
            </header>

            <div className="moneymore-panel__log" ref={listRef} role="log" aria-live="polite">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`moneymore-row moneymore-row--${message.role}${editingId === message.id ? " is-editing" : ""}${message.cards?.length ? " has-cards" : ""}`}
                >
                  <div className="moneymore-bubble-msg">
                    <span className="moneymore-bubble-msg__who">
                      {message.role === "assistant" ? "MoneyMore" : "我"}
                    </span>
                    {message.role === "assistant" ? (
                      <ChatMarkdown text={stripHiddenThink(message.text)} />
                    ) : (
                      <p>{message.text}</p>
                    )}
                    {message.role === "assistant" && message.cards?.length ? (
                      <MoneyMoreStatCards cards={message.cards} formatMoney={formatMoney} />
                    ) : null}
                    {message.role === "user" ? (
                      <button
                        type="button"
                        className="moneymore-icon-btn moneymore-bubble-msg__edit"
                        aria-label="修正这条消息"
                        title="修正"
                        onClick={() => startEdit(message)}
                      >
                        <IconPen />
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="moneymore-row moneymore-row--assistant">
                  <RoseFourLoader elapsedLabel={formatElapsedMs(elapsedMs)} />
                </div>
              ) : null}
              {draft?.action === "create" ? (
                <div className="moneymore-draft" data-section="moneymore-draft">
                  <p>待确认记账 {draft.records.length} 条</p>
                  <ul>
                    {draft.records.map((record, index) => (
                      <li key={`${record.date}-${index}`}>
                        {record.date} · {record.category} · {record.amount} {record.currency}
                        {record.note ? ` · ${record.note}` : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="action-row">
                    <button
                      type="button"
                      data-action="moneymore-confirm-ledger"
                      onClick={onConfirmDraft}
                    >
                      确认记账
                    </button>
                    <button type="button" className="secondary-button" onClick={onCancelDraft}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
              {draft?.action === "update" ? (
                <div className="moneymore-draft" data-section="moneymore-draft-update">
                  <p>待确认修改 {draft.items.length} 条</p>
                  <ul>
                    {draft.items.map((item) => (
                      <li key={item.id}>
                        {item.from.date} · {item.from.category} · {item.from.amount}{" "}
                        {item.from.currency}
                        {item.from.note ? ` · ${item.from.note}` : ""}
                        {" → "}
                        {item.to.date} · {item.to.category} · {item.to.amountText}{" "}
                        {item.to.currency}
                        {item.to.note ? ` · ${item.to.note}` : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="action-row">
                    <button
                      type="button"
                      data-action="moneymore-confirm-update"
                      onClick={onConfirmDraft}
                    >
                      确认修改
                    </button>
                    <button type="button" className="secondary-button" onClick={onCancelDraft}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
              {draft?.action === "delete" ? (
                <div className="moneymore-draft" data-section="moneymore-draft-delete">
                  <p>待确认删除 {draft.items.length} 条</p>
                  <ul>
                    {draft.items.map((item) => (
                      <li key={item.id}>
                        {item.date} · {item.category} · {item.amount} {item.currency}
                        {item.note ? ` · ${item.note}` : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="action-row">
                    <button
                      type="button"
                      className="danger-button"
                      data-action="moneymore-confirm-delete"
                      onClick={onConfirmDraft}
                    >
                      确认删除
                    </button>
                    <button type="button" className="secondary-button" onClick={onCancelDraft}>
                      取消
                    </button>
                  </div>
                </div>
              ) : null}
              {error ? <p className="nl-error">{error}</p> : null}
            </div>

            <form className="moneymore-composer" onSubmit={(event) => void handleSend(event)}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                placeholder={editingId ? "修正后重新发送" : "问账本，或直接说今天午餐 45 港币"}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type={busy ? "button" : "submit"}
                className={`moneymore-orb-btn${busy ? " is-busy" : ""}`}
                data-action={busy ? "moneymore-interrupt" : "moneymore-send"}
                disabled={!busy && !canSend}
                aria-label={busy ? "打断" : editingId ? "重新发送" : "发送"}
                title={busy ? "打断" : editingId ? "重新发送" : "发送"}
                onClick={handleOrbClick}
              >
                <span className="moneymore-orb-btn__icon" data-active={!busy}>
                  <IconSend />
                </span>
                <span className="moneymore-orb-btn__icon" data-active={busy}>
                  <IconStop />
                </span>
              </button>
            </form>
            <p className="moneymore-panel__foot muted">
              接口来自 <Link to="/console">API 看台</Link>，数据只在本机查询。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
