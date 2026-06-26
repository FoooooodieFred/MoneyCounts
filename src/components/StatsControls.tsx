import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../hooks/useGsapContext";

type StatsCurrencyPickerProps = {
  open: boolean;
  currencies: string[];
  selected: string[];
  onToggle: (currency: string) => void;
  onClose: () => void;
  getLabel: (currency: string) => string;
};

export function StatsCurrencyPicker({
  open,
  currencies,
  selected,
  onToggle,
  onClose,
  getLabel,
}: StatsCurrencyPickerProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel) return;

    const ctx = gsap.context(() => {
      if (!open) return;
      if (prefersReducedMotion()) {
        gsap.set([backdrop, panel], { autoAlpha: 1, clearProps: "transform,opacity,visibility" });
        return;
      }
      gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22, ease: "power2.out" });
      gsap.fromTo(
        panel,
        { autoAlpha: 0, y: 12, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.5)", clearProps: "transform,opacity,visibility" },
      );
    });

    return () => ctx.revert();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="stats-currency-popup-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === backdropRef.current) onClose();
      }}
    >
      <div ref={panelRef} className="stats-currency-popup" role="dialog" aria-label="选择统计货币" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>统计货币</strong>
          <button type="button" className="ghost-button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="stats-currency-popup__chips">
          {currencies.map((currency) => (
            <button
              key={currency}
              type="button"
              className={selected.includes(currency) ? "currency-chip active" : "currency-chip"}
              onClick={() => onToggle(currency)}
              aria-pressed={selected.includes(currency)}
            >
              {currency} · {getLabel(currency)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type SummaryModeToggleProps = {
  mode: "split" | "merged";
  onChange: (mode: "split" | "merged") => void;
};

export function SummaryModeToggle({ mode, onChange }: SummaryModeToggleProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const animate = (next: "split" | "merged") => {
    if (prefersReducedMotion() || !trackRef.current) {
      onChange(next);
      return;
    }
    gsap.fromTo(trackRef.current, { scale: 0.96 }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
    onChange(next);
  };

  return (
    <div ref={trackRef} className="summary-mode-toggle" role="group" aria-label="汇总显示模式">
      <button
        type="button"
        className={mode === "split" ? "active" : undefined}
        aria-pressed={mode === "split"}
        onClick={() => animate("split")}
      >
        分币种
      </button>
      <button
        type="button"
        className={mode === "merged" ? "active" : undefined}
        aria-pressed={mode === "merged"}
        onClick={() => animate("merged")}
      >
        单币种
      </button>
    </div>
  );
}
