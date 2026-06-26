import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../hooks/useGsapContext";

type SettingsModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsModal({ open, title, subtitle, onClose, children }: SettingsModalProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      closingRef.current = false;
      setMounted(true);
    }
  }, [open]);

  const finishClose = useCallback(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    gsap.set([backdrop, panel].filter(Boolean), {
      clearProps: "opacity,visibility,transform",
    });
    closingRef.current = false;
    setMounted(false);
  }, []);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const panel = panelRef.current;
    if (!backdrop || !panel || !mounted) return;

    const ctx = gsap.context(() => {
      gsap.killTweensOf([backdrop, panel]);

      if (prefersReducedMotion()) {
        gsap.set(backdrop, {
          autoAlpha: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        });
        gsap.set(panel, { autoAlpha: open ? 1 : 0, clearProps: "transform,opacity,visibility" });
        if (!open) finishClose();
        return;
      }

      if (open) {
        gsap.set(panel, { autoAlpha: 1, y: 0, scale: 1, clearProps: "transform,opacity,visibility" });
        gsap.set(backdrop, { pointerEvents: "auto" });
        gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "power2.out" });
        return;
      }

      gsap.to(backdrop, { autoAlpha: 0, duration: 0.14, ease: "power2.in" });
      gsap.to(panel, {
        autoAlpha: 0,
        duration: 0.12,
        ease: "power2.in",
        onComplete: finishClose,
      });
    });

    return () => ctx.revert();
  }, [finishClose, mounted, open]);

  useEffect(() => {
    if (!mounted || !open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted, open, requestClose]);

  useEffect(() => {
    if (!mounted || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mounted, open]);

  if (!mounted) return null;

  return (
    <div
      ref={backdropRef}
      className="settings-modal-backdrop is-open"
      role="presentation"
      onClick={(event) => {
        if (event.target === backdropRef.current) requestClose();
      }}
    >
      <section
        ref={panelRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-modal__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="ghost-button settings-modal__close" onClick={requestClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="settings-modal__body">{children}</div>
      </section>
    </div>
  );
}
