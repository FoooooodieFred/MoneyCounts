import { ReactNode, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

gsap.registerPlugin(ScrollTrigger);

type FeatureBlockProps = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  variant?: "mint" | "sunset" | "sky" | "violet" | "neutral";
  children: ReactNode;
};

export function FeatureBlock({ id, eyebrow, title, subtitle, variant = "neutral", children }: FeatureBlockProps) {
  const blockRef = useRef<HTMLElement | null>(null);

  useGsapContext(blockRef, (ctx) => {
    const el = blockRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.from(el, {
      y: 48,
      autoAlpha: 0,
      duration: 0.72,
      ease: "power3.out",
      immediateRender: false,
      clearProps: "transform,opacity,visibility",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        once: true,
      },
    });
    ScrollTrigger.refresh();
  }, [id]);

  return (
    <section ref={blockRef} id={id} className={`feature-block feature-block--${variant}`}>
      <header className="feature-block__header">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </header>
      <div className="feature-block__body">{children}</div>
    </section>
  );
}
