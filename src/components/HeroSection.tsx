import { CSSProperties, PointerEvent, useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { useGsapContext, prefersReducedMotion } from "../hooks/useGsapContext";

export type HeroStatCard = {
  id: string;
  title: string;
  value: string;
  hint: string;
  variant: string;
  effect: "float" | "tilt" | "pulse" | "spark" | "orbit" | "flip";
  accent: string;
  clickable?: boolean;
  progress?: number;
};

type HeroSectionProps = {
  selectedDate: string;
  weekdayLabel: string;
  statCards: HeroStatCard[];
  onOpenDatePicker: () => void;
  onPrevDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
  onShuffleCards: () => void;
  onStatCardClick?: (cardId: string) => void;
  showStats?: boolean;
};

export function HeroSection({
  selectedDate,
  weekdayLabel,
  statCards,
  onOpenDatePicker,
  onPrevDay,
  onToday,
  onNextDay,
  onShuffleCards,
  onStatCardClick,
  showStats = true,
}: HeroSectionProps) {
  const heroRef = useRef<HTMLElement | null>(null);
  const shuffleTweenRef = useRef<gsap.core.Tween | null>(null);
  const pendingShuffleFadeInRef = useRef(false);

  useEffect(() => () => {
    shuffleTweenRef.current?.kill();
  }, []);

  useGsapContext(heroRef, (ctx) => {
    const targets = ctx.selector?.("[data-motion='hero-card'], [data-motion='hero-headline'], [data-motion='hero-date']") ?? [];
    if (prefersReducedMotion()) {
      if (targets.length) gsap.set(targets, { clearProps: "opacity,visibility,transform" });
      return;
    }
    gsap.fromTo(
      "[data-motion='hero-date']",
      { autoAlpha: 0, y: -16 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      },
    );
    gsap.fromTo(
      "[data-motion='hero-card']",
      { autoAlpha: 0, y: 28, scale: 0.94 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        stagger: 0.09,
        duration: 0.62,
        ease: "back.out(1.6)",
        delay: 0.12,
        clearProps: "transform,opacity,visibility",
      },
    );
    gsap.fromTo(
      "[data-motion='hero-headline']",
      { autoAlpha: 0, y: 22 },
      {
        autoAlpha: 1,
        y: 0,
        duration: 0.55,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      },
    );
  }, [selectedDate, statCards.length]);

  useLayoutEffect(() => {
    if (!pendingShuffleFadeInRef.current) return;
    pendingShuffleFadeInRef.current = false;

    const root = heroRef.current;
    if (!root) return;

    const cards = root.querySelectorAll("[data-motion='hero-card']");
    if (!cards.length) return;

    if (prefersReducedMotion()) {
      gsap.set(cards, { clearProps: "opacity,visibility,transform" });
      return;
    }

    shuffleTweenRef.current?.kill();
    shuffleTweenRef.current = gsap.fromTo(
      cards,
      { autoAlpha: 0, y: 14, scale: 0.97 },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        stagger: 0.07,
        duration: 0.45,
        ease: "power3.out",
        clearProps: "transform,opacity,visibility",
      },
    );
  }, [statCards]);

  const handleShuffleCards = () => {
    const root = heroRef.current;
    if (!root || prefersReducedMotion()) {
      onShuffleCards();
      return;
    }

    const cards = root.querySelectorAll("[data-motion='hero-card']");
    if (!cards.length) {
      onShuffleCards();
      return;
    }

    shuffleTweenRef.current?.kill();
    shuffleTweenRef.current = gsap.to(cards, {
      autoAlpha: 0,
      y: 10,
      scale: 0.97,
      duration: 0.25,
      ease: "power2.in",
      stagger: 0.04,
      onComplete: () => {
        pendingShuffleFadeInRef.current = true;
        onShuffleCards();
      },
    });
  };

  const handleCardEnter = (event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const card = event.currentTarget;
    gsap.to(card, { y: -10, scale: 1.03, rotation: 0.6, duration: 0.32, ease: "back.out(2)" });
  };

  const handleCardLeave = (event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    gsap.to(event.currentTarget, { y: 0, scale: 1, rotation: 0, duration: 0.42, ease: "elastic.out(1, 0.6)" });
  };

  return (
    <section ref={heroRef} className="hero-section" id="hero" data-section="hero">
      <article className="hero-date-banner" data-motion="hero-date">
        <button type="button" className="hero-date-banner__main" data-action="open-date-picker" onClick={onOpenDatePicker}>
          <span className="hero-date-banner__eyebrow">记账日期</span>
          <strong>{selectedDate}</strong>
          <em>{weekdayLabel}</em>
        </button>
        <div className="hero-date-banner__nav" aria-label="日期导航">
          <button type="button" className="secondary-button" data-action="date-prev" onClick={onPrevDay} aria-label="前一天">
            ‹ 前一天
          </button>
          <button type="button" data-action="date-today" onClick={onToday}>
            今天
          </button>
          <button type="button" className="secondary-button" data-action="date-next" onClick={onNextDay} aria-label="后一天">
            后一天 ›
          </button>
        </div>
      </article>

      <div className="hero-section__top">
        <div className="hero-copy">
          <p className="eyebrow">MoneyCounts</p>
          <h1 className="hero-headline" data-motion="hero-headline">
            今天也要
            <span> 轻松记账</span>
          </h1>
        </div>
      </div>

      {showStats ? <div className="hero-stats">
        <div className="hero-stats__heading">
          <span>趣味小卡片</span>
          <button type="button" className="ghost-button" data-action="shuffle-hero-cards" onClick={handleShuffleCards}>
            换一组
          </button>
        </div>
        <div className="hero-stats__grid">
          {statCards.map((card) => {
            const Tag = card.clickable ? "button" : "article";
            return (
              <Tag
                key={card.id}
                type={card.clickable ? "button" : undefined}
                className={`hero-stat-card hero-stat-card--${card.variant}${card.clickable ? " hero-stat-card--clickable" : ""}`}
                data-motion="hero-card"
                data-effect={card.effect}
                style={{ "--fun-accent": card.accent } as CSSProperties}
                onPointerEnter={handleCardEnter}
                onPointerLeave={handleCardLeave}
                onClick={card.clickable && onStatCardClick ? () => onStatCardClick(card.id) : undefined}
              >
                <span className="hero-stat-card__orb" aria-hidden="true" />
                <p>{card.title}</p>
                <strong>{card.value}</strong>
                <div className="hero-stat-card__progress-slot">
                  {typeof card.progress === "number" ? (
                    <span className="hero-stat-card__progress" aria-label={`${card.title} ${card.progress}%`}>
                      <span style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }} />
                    </span>
                  ) : null}
                </div>
                <small>{card.hint}</small>
              </Tag>
            );
          })}
        </div>
      </div> : null}
    </section>
  );
}
