import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

/** Fade/slide page contents in on mount. Respects reduced-motion. */
export function RouteEnter({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGsapContext(rootRef, () => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll<HTMLElement>(
      ".page-intro:not(.feature-block__header), .nl-section, .stats-card, .surface-secondary, .travel-card, .travel-hero",
    );
    const nodes = targets.length ? Array.from(targets) : [root];
    if (prefersReducedMotion()) {
      gsap.set(nodes, { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.from(nodes, {
      y: 18,
      autoAlpha: 0,
      duration: 0.48,
      stagger: nodes.length > 1 ? 0.055 : 0,
      ease: "power3.out",
      clearProps: "transform,opacity,visibility",
    });
  }, []);

  return (
    <div ref={rootRef} className="route-enter">
      {children}
    </div>
  );
}
