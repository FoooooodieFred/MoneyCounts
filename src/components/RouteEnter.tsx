import { useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

/**
 * 页面入场动画。
 *
 * 整页作为一个整体淡入，不给每张卡片单独做 stagger：
 * 逐个元素错峰淡入时，页面会先后分批冒出来，看着像卡顿；一次整体淡入干净利落。
 * 另外用 useLayoutEffect 建 GSAP 上下文（见 useGsapContext），
 * 保证起始态在绘制前就设好，不会出现「先看见再消失」的那一下。
 */
export function RouteEnter({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useGsapContext(rootRef, () => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) {
      gsap.set(root, { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.from(root, {
      y: 18,
      autoAlpha: 0,
      duration: 0.42,
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
