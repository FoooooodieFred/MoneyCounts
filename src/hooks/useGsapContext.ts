import { RefObject, useEffect } from "react";
import { gsap } from "gsap";

export function useGsapContext(
  scopeRef: RefObject<HTMLElement | null>,
  setup: (ctx: gsap.Context) => void,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const root = scopeRef.current;
    if (!root) return;

    const ctx = gsap.context((self) => setup(self), root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
