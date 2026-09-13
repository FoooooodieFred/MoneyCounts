import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../hooks/useGsapContext";

const SVG_NS = "http://www.w3.org/2000/svg";

const config = {
  rotate: true,
  particleCount: 28,
  trailSpan: 0.12,
  durationMs: 4000,
  rotationDurationMs: 28000,
  pulseDurationMs: 4500,
  strokeWidth: 2.9,
  roseA: 7.1,
  roseABoost: 0.2,
  roseBreathBase: 1.05,
  roseBreathBoost: 0.21,
  roseScale: 3.15,
};

const pointAt = (progress: number, detailScale: number) => {
  const t = progress * Math.PI * 2;
  const a = config.roseA + detailScale * config.roseABoost;
  const r = a * (config.roseBreathBase + detailScale * config.roseBreathBoost) * Math.cos(4 * t);
  return {
    x: 50 + Math.cos(t) * r * config.roseScale,
    y: 50 + Math.sin(t) * r * config.roseScale,
  };
};

const normalizeProgress = (progress: number) => ((progress % 1) + 1) % 1;

const getDetailScale = (time: number) => {
  const pulseProgress = (time % config.pulseDurationMs) / config.pulseDurationMs;
  const pulseAngle = pulseProgress * Math.PI * 2;
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48;
};

const buildPath = (detailScale: number, steps = 240) =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const point = pointAt(index / steps, detailScale);
    return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(" ");

type RoseFourLoaderProps = {
  label?: string;
  elapsedLabel?: string;
};

export function RoseFourLoader({
  label = "MoneyMore 正在处理",
  elapsedLabel,
}: RoseFourLoaderProps) {
  const groupRef = useRef<SVGGElement | null>(null);
  const pathRef = useRef<SVGPathElement | null>(null);
  const particlesRef = useRef<SVGCircleElement[]>([]);

  useEffect(() => {
    const group = groupRef.current;
    const path = pathRef.current;
    if (!group || !path) return;

    particlesRef.current = Array.from({ length: config.particleCount }, () => {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("fill", "currentColor");
      group.appendChild(circle);
      return circle;
    });

    if (prefersReducedMotion()) {
      const detailScale = 0.8;
      path.setAttribute("d", buildPath(detailScale));
      particlesRef.current.forEach((node, index) => {
        const tailOffset = index / Math.max(1, config.particleCount - 1);
        const point = pointAt(normalizeProgress(0.18 - tailOffset * config.trailSpan), detailScale);
        const fade = (1 - tailOffset) ** 0.56;
        node.setAttribute("cx", point.x.toFixed(2));
        node.setAttribute("cy", point.y.toFixed(2));
        node.setAttribute("r", (0.9 + fade * 2.7).toFixed(2));
        node.setAttribute("opacity", (0.04 + fade * 0.96).toFixed(3));
      });
      return () => {
        particlesRef.current.forEach((node) => node.remove());
        particlesRef.current = [];
      };
    }

    const startedAt = performance.now();
    let frame = 0;
    const render = (now: number) => {
      const time = now - startedAt;
      const progress = (time % config.durationMs) / config.durationMs;
      const detailScale = getDetailScale(time);
      const rotation = -((time % config.rotationDurationMs) / config.rotationDurationMs) * 360;
      group.setAttribute("transform", `rotate(${rotation} 50 50)`);
      path.setAttribute("d", buildPath(detailScale));
      particlesRef.current.forEach((node, index) => {
        const tailOffset = index / Math.max(1, config.particleCount - 1);
        const point = pointAt(
          normalizeProgress(progress - tailOffset * config.trailSpan),
          detailScale,
        );
        const fade = (1 - tailOffset) ** 0.56;
        node.setAttribute("cx", point.x.toFixed(2));
        node.setAttribute("cy", point.y.toFixed(2));
        node.setAttribute("r", (0.9 + fade * 2.7).toFixed(2));
        node.setAttribute("opacity", (0.04 + fade * 0.96).toFixed(3));
      });
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      particlesRef.current.forEach((node) => node.remove());
      particlesRef.current = [];
    };
  }, []);

  return (
    <div className="rose-four" role="status" aria-live="polite" aria-label={label}>
      <svg className="rose-four__svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g ref={groupRef}>
          <path
            ref={pathRef}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.14"
            strokeWidth={config.strokeWidth}
          />
        </g>
      </svg>
      <div className="rose-four__meta">
        <span>{label}</span>
        {elapsedLabel ? <strong>{elapsedLabel}</strong> : null}
      </div>
    </div>
  );
}
