import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

type FloatingActionsProps = {
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
};

export function FloatingActions({
  themeMode,
  onToggleTheme,
  onPrevDay,
  onToday,
  onNextDay,
}: FloatingActionsProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGsapContext(rootRef, (ctx) => {
    if (prefersReducedMotion()) {
      gsap.set(ctx.selector?.(".fab-btn") ?? [], { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.fromTo(
      ".fab-btn",
      { autoAlpha: 0, scale: 0.82, y: 12 },
      {
        autoAlpha: 1,
        scale: 1,
        y: 0,
        stagger: 0.06,
        duration: 0.45,
        ease: "back.out(1.6)",
        delay: 0.2,
        clearProps: "transform,opacity,visibility",
      },
    );
  }, []);

  const pulseTheme = () => {
    if (prefersReducedMotion()) return;
    const btn = rootRef.current?.querySelector(".floating-theme-toggle");
    if (!btn) return;
    gsap.fromTo(btn, { rotation: -20, scale: 0.9 }, { rotation: 0, scale: 1, duration: 0.5, ease: "back.out(2)" });
  };

  useEffect(() => {
    pulseTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  const fabClick = (action: () => void, selector: string) => {
    if (!prefersReducedMotion()) {
      const btn = rootRef.current?.querySelector(selector);
      if (btn) {
        gsap.fromTo(btn, { scale: 0.88 }, { scale: 1, duration: 0.35, ease: "elastic.out(1, 0.5)" });
      }
    }
    action();
  };

  return (
    <div ref={rootRef} className="floating-actions-root" aria-label="快捷操作">
      <button
        type="button"
        className="floating-theme-toggle fab-btn"
        data-action="toggle-theme"
        onClick={() => fabClick(onToggleTheme, ".floating-theme-toggle")}
        aria-label={themeMode === "dark" ? "切换浅色模式" : "切换深色模式"}
        title={themeMode === "dark" ? "浅色模式" : "深色模式"}
      >
        <span aria-hidden="true">{themeMode === "dark" ? "☀" : "☾"}</span>
      </button>

      <div className="floating-date-fabs" aria-label="日期快捷切换">
        <button
          type="button"
          className="floating-date-fab fab-btn"
          data-action="floating-date-prev"
          onClick={() => fabClick(onPrevDay, ".floating-date-fab:nth-child(1)")}
          aria-label="前一天"
          title="前一天"
        >
          ‹
        </button>
        <button
          type="button"
          className="floating-date-fab floating-date-fab--today fab-btn"
          data-action="floating-date-today"
          onClick={() => fabClick(onToday, ".floating-date-fab--today")}
          aria-label="今天"
          title="今天"
        >
          ●
        </button>
        <button
          type="button"
          className="floating-date-fab fab-btn"
          data-action="floating-date-next"
          onClick={() => fabClick(onNextDay, ".floating-date-fab:nth-child(3)")}
          aria-label="后一天"
          title="后一天"
        >
          ›
        </button>
      </div>
    </div>
  );
}
