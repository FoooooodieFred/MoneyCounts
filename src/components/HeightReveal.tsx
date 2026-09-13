import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "../hooks/useGsapContext";

type HeightRevealProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
};

export function HeightReveal({ open, children, className }: HeightRevealProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const bootedRef = useRef(false);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const inner = innerRef.current;
    const reduced = prefersReducedMotion();
    gsap.killTweensOf(panel);
    if (inner) gsap.killTweensOf(inner);

    if (!bootedRef.current) {
      bootedRef.current = true;
      gsap.set(panel, { height: open ? "auto" : 0, overflow: "hidden" });
      if (inner) gsap.set(inner, { y: 0 });
      return;
    }

    if (reduced) {
      gsap.set(panel, { height: open ? "auto" : 0, overflow: "hidden" });
      if (inner) gsap.set(inner, { y: 0 });
      return;
    }

    if (open) {
      const from = panel.getBoundingClientRect().height;
      gsap.set(panel, { height: "auto", overflow: "hidden" });
      const to = panel.offsetHeight;
      gsap.set(panel, { height: from });
      gsap.to(panel, {
        height: to,
        duration: 0.66,
        ease: "expo.out",
        overwrite: "auto",
        autoRound: false,
        onComplete: () => gsap.set(panel, { height: "auto" }),
      });
      if (inner) {
        gsap.fromTo(
          inner,
          { y: 18 },
          { y: 0, duration: 0.66, ease: "expo.out", overwrite: "auto" },
        );
      }
      return;
    }

    gsap.set(panel, { height: panel.offsetHeight, overflow: "hidden" });
    gsap.to(panel, {
      height: 0,
      duration: 0.46,
      ease: "power3.inOut",
      overwrite: "auto",
      autoRound: false,
    });
    if (inner) {
      gsap.to(inner, { y: 10, duration: 0.46, ease: "power3.inOut", overwrite: "auto" });
    }
  }, [open, mounted]);

  return (
    <div ref={panelRef} className={className} aria-hidden={!open} inert={open ? undefined : true}>
      {mounted ? (
        <div ref={innerRef} className="height-reveal__inner">
          {children}
        </div>
      ) : null}
    </div>
  );
}
