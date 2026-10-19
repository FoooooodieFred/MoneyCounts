import { RefObject, useLayoutEffect } from "react";
import { gsap } from "gsap";

/**
 * 在组件挂载后建立 GSAP 上下文。
 *
 * 用 `useLayoutEffect` 而不是 `useEffect`：`gsap.from()` 会先把目标设成起始态
 * （透明、位移）再补间回来。放在 effect 里的话，浏览器已经先把内容画出来了，
 * 下一帧内容又「啪」一下消失再淡入——打开页面时看着就是卡一下。
 * layout effect 在绘制前就把起始态设好，中间不会闪。
 */
export function useGsapContext(
  scopeRef: RefObject<HTMLElement | null>,
  setup: (ctx: gsap.Context) => void,
  deps: unknown[] = [],
) {
  useLayoutEffect(() => {
    const root = scopeRef.current;
    if (!root) return;

    const ctx = gsap.context((self) => setup(self), root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
