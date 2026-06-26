import { CSSProperties } from "react";

type CategorySummaryItem = {
  category: string;
  value: number;
  percent: number;
  color: string;
};

export type PieChartProps = {
  summary: CategorySummaryItem[];
  title: string;
};

export type TrendChartProps = {
  rows: Array<{ month: string; value: number }>;
  min: number;
  max: number;
};

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

export function PieChart({ summary, title }: PieChartProps) {
  const size = 160;
  const center = size / 2;
  const radius = 68;
  const holeRadius = radius * 0.3;
  let cursor = 0;

  if (!summary.length) {
    return <div className="pie-chart empty" aria-label={`${title} 类目占比图`} />;
  }

  return (
    <svg className="pie-chart" viewBox="0 0 160 160" role="img" aria-label={`${title} 类目占比图`}>
      {summary.map((item) => {
        const startAngle = (cursor / 100) * 360;
        cursor += item.percent;
        const endAngle = (cursor / 100) * 360;
        const midAngle = (startAngle + endAngle) / 2;
        const labelPoint = polarToCartesian(center, radius * 0.72, midAngle);
        const hoverPoint = polarToCartesian(0, 2, midAngle);
        const sliceStyle = {
          "--hover-x": `${hoverPoint.x}px`,
          "--hover-y": `${hoverPoint.y}px`,
        } as CSSProperties;

        return (
          <g key={item.category} className="pie-slice" style={sliceStyle}>
            {item.percent >= 99.999 ? (
              <circle cx={center} cy={center} r={radius} fill={item.color} />
            ) : (
              <path d={getPieSlicePath(center, radius, startAngle, endAngle)} fill={item.color} />
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

export function TrendChart({ rows, min, max }: TrendChartProps) {
  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? 300 : 24 + (index / (rows.length - 1)) * 552;
      const y = 188 - ((row.value - min) / (max - min || 1)) * 156;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="trend-chart" viewBox="0 0 600 220" role="img" aria-label="近 N 个月月度总花费折线图">
      <line x1="24" y1="188" x2="576" y2="188" />
      <polyline points={points} />
      {rows.map((row, index) => {
        const x = rows.length === 1 ? 300 : 24 + (index / (rows.length - 1)) * 552;
        const y = 188 - ((row.value - min) / (max - min || 1)) * 156;
        return (
          <g key={row.month}>
            <circle cx={x} cy={y} r="4" />
            <text x={x} y="208">
              {row.month.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
