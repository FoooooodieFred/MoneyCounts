import { useEffect, useId, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../hooks/useGsapContext";
import { NOTIF_BLUE, type DotRender } from "../lib/bloub/decor";
import { BotEngine, type BotFrame } from "../lib/bloub/engine";
import { DEMI_VIEWBOX, RAYON } from "../lib/bloub/repere";
import { COLOR_BY_ID, SHAPE_BY_ID, mixHex } from "../lib/bloub/skins";
import { makeBlock, type Block } from "../lib/bloub/cycles";

export const BLOUB_INK = COLOR_BY_ID.get("bleu")?.hex ?? "#3b93f0";
export const BLOUB_PAPER = "#f6f8fa";

const CIRCLE = SHAPE_BY_ID.get("cercle")?.radii ?? null;

const IDLE_CYCLE: Block[] = [makeBlock("idle")];
const LOADING_CYCLE: Block[] = [makeBlock("orbit"), makeBlock("wink"), makeBlock("notify")];

export type BloubMood = "idle" | "loading";

type BloubAvatarProps = {
  size?: number;
  mood?: BloubMood;
  label?: string;
  paper?: string;
  decorative?: boolean;
};

const cycleFor = (mood: BloubMood) => (mood === "loading" ? LOADING_CYCLE : IDLE_CYCLE);

const dotFill = (dot: DotRender, paper: string) =>
  dot.color ?? (dot.depth === undefined ? BLOUB_INK : mixHex(paper, BLOUB_INK, dot.depth));

function BloubDots({ dots, paper, mark }: { dots: DotRender[]; paper: string; mark: string }) {
  return (
    <>
      {dots.map((dot, index) =>
        dot.d ? (
          <path
            key={`${mark}-${index}`}
            d={dot.d}
            transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
            fill={dotFill(dot, paper)}
            opacity={dot.opacity}
          />
        ) : (
          <circle
            key={`${mark}-${index}`}
            cx={dot.x}
            cy={dot.y}
            r={dot.r}
            fill={dotFill(dot, paper)}
            opacity={dot.opacity}
          />
        ),
      )}
    </>
  );
}

export function BloubAvatar({
  size = 36,
  mood = "idle",
  label = "MoneyMore",
  paper = BLOUB_PAPER,
  decorative = false,
}: BloubAvatarProps) {
  const reactId = useId().replace(/:/g, "");
  const maskId = `bloub-mask-${reactId}`;
  const engine = useMemo(() => new BotEngine(RAYON, "idle", CIRCLE), []);
  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(0.35));
  const clockRef = useRef(0);
  const blockRef = useRef(0);
  const blockStartRef = useRef(0);

  useEffect(() => {
    const blocks = cycleFor(mood);
    clockRef.current = 0;
    blockRef.current = 0;
    blockStartRef.current = 0;
    engine.reset(blocks[0]?.state ?? "idle", 0);
    setFrame(engine.sample(prefersReducedMotion() ? 0.35 : 0));
    if (prefersReducedMotion()) return;

    let raf = 0;
    let last = 0;
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((ms - last) / 1000, 0.064) : 0;
      last = ms;
      clockRef.current += dt;
      const clock = clockRef.current;
      const current = blocks[blockRef.current];
      if (current && clock - blockStartRef.current >= current.duration) {
        blockRef.current = (blockRef.current + 1) % blocks.length;
        blockStartRef.current = clock;
        const next = blocks[blockRef.current];
        if (next) engine.setState(next.state, clock);
      }
      setFrame(engine.sample(clock));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, mood]);

  const view = mood === "loading" ? DEMI_VIEWBOX : RAYON + 10;
  const svgSize = mood === "loading" ? size * (DEMI_VIEWBOX / RAYON) : size;
  const shift = mood === "loading" ? (svgSize - size) / 2 : 0;

  return (
    <span
      className={`bloub-avatar${mood === "loading" ? " is-loading" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`${-view} ${-view} ${view * 2} ${view * 2}`}
        role={decorative ? "presentation" : "img"}
        aria-label={decorative ? undefined : label}
        aria-hidden={decorative ? true : undefined}
        style={{ margin: `-${shift}px` }}
      >
        <defs>
          <mask
            id={maskId}
            maskUnits="userSpaceOnUse"
            x={-view}
            y={-view}
            width={view * 2}
            height={view * 2}
          >
            <path d={frame.bodyPath} fill="#fff" />
            {frame.eyes.map((eye, index) => (
              <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
            ))}
            {frame.notch ? (
              <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />
            ) : null}
          </mask>
          {frame.arcs.map((arc) => (
            <linearGradient
              key={arc.id}
              id={`${reactId}-${arc.id}`}
              gradientUnits="userSpaceOnUse"
              x1={arc.grad.x1}
              y1={arc.grad.y1}
              x2={arc.grad.x2}
              y2={arc.grad.y2}
            >
              {arc.grad.stops.map((color, index) => (
                <stop
                  key={index}
                  offset={index / Math.max(1, arc.grad.stops.length - 1)}
                  stopColor={color}
                />
              ))}
            </linearGradient>
          ))}
        </defs>

        <g fill="none" strokeLinecap="round">
          {frame.arcs.map((arc) => (
            <path
              key={`b${arc.id}`}
              d={arc.back}
              stroke={`url(#${reactId}-${arc.id})`}
              strokeWidth={arc.width}
              opacity={arc.opacity}
            />
          ))}
        </g>

        {frame.dotsBehind ? <BloubDots dots={frame.dots} paper={paper} mark="back" /> : null}

        <g opacity={frame.bodyAlpha}>
          <path d={frame.bodyPath} fill={paper} />
          <g mask={`url(#${maskId})`}>
            <rect x={-view} y={-view} width={view * 2} height={view * 2} fill={BLOUB_INK} />
          </g>
        </g>

        {!frame.dotsBehind ? <BloubDots dots={frame.dots} paper={paper} mark="front" /> : null}

        {frame.notif ? (
          <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} fill={NOTIF_BLUE} />
        ) : null}

        <g fill="none" strokeLinecap="round">
          {frame.arcs.map((arc) => (
            <path
              key={`f${arc.id}`}
              d={arc.front}
              stroke={`url(#${reactId}-${arc.id})`}
              strokeWidth={arc.width}
              opacity={arc.opacity}
            />
          ))}
        </g>
      </svg>
    </span>
  );
}
