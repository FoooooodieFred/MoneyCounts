import { CSSProperties } from "react";
import type { CurrencyDistributionItem, TravelHistoryCategory } from "./travelMode";

const polarToCartesian = (center: number, radius: number, angle: number) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
};

const getPieSlicePath = (center: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(center, radius, endAngle);
  const end = polarToCartesian(center, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${center} ${center}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const PIE_COLORS = [
  "#A7D397",
  "#89CFF0",
  "#F4C2C2",
  "#FFDAB9",
  "#B4A7D6",
  "#C9E4DE",
  "#FFE5B4",
  "#E6E6FA",
  "#B0E0E6",
  "#D3D3D3",
];

export type CategoryChartItem = TravelHistoryCategory & { color?: string };

export function TravelPieChart({
  summary,
  title,
  size = 160,
}: {
  summary: CategoryChartItem[];
  title: string;
  size?: number;
}) {
  const center = size / 2;
  const radius = size * 0.425;
  const holeRadius = radius * 0.3;
  let cursor = 0;

  if (!summary.length) {
    return <div className="pie-chart empty travel-viz-empty" aria-label={`${title} 类目占比图`} />;
  }

  return (
    <svg className="pie-chart travel-viz-pie" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title} 类目占比图`}>
      {summary.map((item, index) => {
        const startAngle = (cursor / 100) * 360;
        cursor += item.percent;
        const endAngle = (cursor / 100) * 360;
        const midAngle = (startAngle + endAngle) / 2;
        const labelPoint = polarToCartesian(center, radius * 0.72, midAngle);
        const hoverPoint = polarToCartesian(0, 2, midAngle);
        const color = item.color ?? PIE_COLORS[index % PIE_COLORS.length];
        const sliceStyle = {
          "--hover-x": `${hoverPoint.x}px`,
          "--hover-y": `${hoverPoint.y}px`,
        } as CSSProperties;

        return (
          <g key={item.category} className="pie-slice" style={sliceStyle}>
            {item.percent >= 99.999 ? (
              <circle cx={center} cy={center} r={radius} fill={color} />
            ) : (
              <path d={getPieSlicePath(center, radius, startAngle, endAngle)} fill={color} />
            )}
            {item.percent >= 6 && (
              <text x={labelPoint.x} y={labelPoint.y} className="pie-label">
                {item.percent.toFixed(0)}%
              </text>
            )}
          </g>
        );
      })}
      <circle cx={center} cy={center} r={holeRadius} className="pie-hole" />
    </svg>
  );
}

export function TravelCurrencyBars({
  items,
  targetCurrency,
  formatMoney,
}: {
  items: CurrencyDistributionItem[];
  targetCurrency: string;
  formatMoney: (value: number, currency: string) => string;
}) {
  if (!items.length) {
    return <p className="muted">暂无货币分布数据。</p>;
  }

  const maxPercent = Math.max(...items.map((item) => item.percent), 1);

  return (
    <div className="travel-currency-bars" aria-label="货币分布条形图">
      {items.map((item) => (
        <div key={item.currency} className="travel-currency-bar-row">
          <div className="travel-currency-bar-meta">
            <strong>{item.currency}</strong>
            <span>{item.count} 笔 · {item.percent.toFixed(1)}%</span>
          </div>
          <div className="travel-currency-bar-track">
            <span
              className="travel-currency-bar-fill"
              style={{
                width: `${(item.percent / maxPercent) * 100}%`,
                background: `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color}, white 28%))`,
              }}
            />
          </div>
          <small>
            {formatMoney(item.nativeTotal, item.currency)} · 折合 {formatMoney(item.convertedTotal, targetCurrency)}
          </small>
        </div>
      ))}
    </div>
  );
}

export function TravelStatCards({
  cards,
}: {
  cards: Array<{ label: string; value: string; hint?: string; accent?: string }>;
}) {
  return (
    <div className="travel-stat-cards">
      {cards.map((card) => (
        <article
          key={card.label}
          className="travel-stat-card"
          style={{ "--travel-accent": card.accent ?? "var(--aqua)" } as CSSProperties}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {card.hint ? <small>{card.hint}</small> : null}
        </article>
      ))}
    </div>
  );
}
