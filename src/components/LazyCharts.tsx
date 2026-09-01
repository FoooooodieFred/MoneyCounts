import { CSSProperties, useMemo, useState } from "react";
import { groupMonthRowsByYear, yearRowCells } from "../lib/yearTrend";

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
  currency?: string;
  formatValue?: (value: number) => string;
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

const MONTH_MARKS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const defaultFormat = (value: number) =>
  value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });

export function TrendChart({ rows, min, max, currency, formatValue }: TrendChartProps) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const format = formatValue ?? defaultFormat;
  const rangeStart = rows[0]?.month ?? "";
  const rangeEnd = rows.at(-1)?.month ?? "";
  const byMonth = useMemo(() => new Map(rows.map((row) => [row.month, row.value])), [rows]);
  const years = useMemo(() => groupMonthRowsByYear(rows), [rows]);
  const peak = useMemo(
    () => rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]),
    [rows],
  );
  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);
  const span = max - min || 1;
  const toX = (index: number) => (rows.length <= 1 ? 320 : 28 + (index / (rows.length - 1)) * 584);
  const toY = (value: number) => 132 - ((value - min) / span) * 104;
  const active = rows.find((row) => row.month === activeMonth) ?? peak;
  const linePoints = rows
    .map((row, index) => `${toX(index).toFixed(1)},${toY(row.value).toFixed(1)}`)
    .join(" ");
  const area =
    rows.length === 0
      ? ""
      : [
          `M ${toX(0).toFixed(1)},132`,
          ...rows.map((row, index) => `L ${toX(index).toFixed(1)},${toY(row.value).toFixed(1)}`),
          `L ${toX(rows.length - 1).toFixed(1)},132`,
          "Z",
        ].join(" ");
  const yearTicks = years.map((item) => {
    const january = rows.findIndex((row) => row.month === `${item.year}-01`);
    const fallback = rows.findIndex((row) => row.month.startsWith(`${item.year}-`));
    const at = january >= 0 ? january : fallback;
    return { year: item.year, x: toX(Math.max(0, at)) };
  });
  const showDots = rows.length <= 36;

  if (!rows.length) {
    return (
      <div className="history-trend history-trend--empty" role="img" aria-label="尚无趋势数据">
        <p>还没有可绘制的记账月份。</p>
      </div>
    );
  }

  return (
    <div className="history-trend">
      <div className="history-trend__readout" aria-live="polite">
        <div>
          <span>跨度</span>
          <strong>
            {rangeStart} → {rangeEnd}
          </strong>
        </div>
        <div>
          <span>{active?.month === peak?.month ? "峰值月" : "当前月"}</span>
          <strong>
            {active?.month} · {format(active?.value ?? 0)}
            {formatValue ? "" : currency ? ` ${currency}` : ""}
          </strong>
        </div>
        <div>
          <span>区间合计</span>
          <strong>
            {format(total)}
            {formatValue ? "" : currency ? ` ${currency}` : ""}
          </strong>
        </div>
      </div>
      <svg
        className="history-trend__river"
        viewBox="0 0 640 168"
        role="img"
        aria-label={`从 ${rangeStart} 到 ${rangeEnd} 的月度花费河流图`}
      >
        <defs>
          <linearGradient id="history-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yearTicks.map((tick) => (
          <g key={tick.year}>
            <line className="history-trend__year-guide" x1={tick.x} y1="16" x2={tick.x} y2="132" />
            <text className="history-trend__year-tick" x={tick.x} y="154">
              {tick.year}
            </text>
          </g>
        ))}
        <path className="history-trend__area" d={area} />
        <polyline className="history-trend__line" points={linePoints} />
        {showDots ? (
          rows.map((row, index) => (
            <circle
              key={row.month}
              className={
                row.month === peak.month
                  ? "history-trend__dot history-trend__dot--peak"
                  : "history-trend__dot"
              }
              cx={toX(index)}
              cy={toY(row.value)}
              r={row.month === peak.month ? 5 : 3}
              onMouseEnter={() => setActiveMonth(row.month)}
              onFocus={() => setActiveMonth(row.month)}
            >
              <title>
                {row.month}: {format(row.value)}
              </title>
            </circle>
          ))
        ) : peak ? (
          <circle
            className="history-trend__dot history-trend__dot--peak"
            cx={toX(rows.findIndex((row) => row.month === peak.month))}
            cy={toY(peak.value)}
            r="5"
          >
            <title>
              {peak.month}: {format(peak.value)}
            </title>
          </circle>
        ) : null}
      </svg>
      <div className="history-trend__legend" aria-hidden="true">
        {MONTH_MARKS.map((label) => (
          <span key={label}>{label}月</span>
        ))}
      </div>
      <div className="history-trend__strata" role="list">
        {years.map((item) => {
          const yearTotal = item.months.reduce((sum, row) => sum + row.value, 0);
          return (
            <div key={item.year} className="history-trend__year-row" role="listitem">
              <span className="history-trend__year-label">{item.year}</span>
              <div className="history-trend__cells">
                {yearRowCells(item.year, byMonth, rangeStart, rangeEnd).map((cell) => {
                  const intensity = max <= 0 ? 0 : Math.min(1, cell.value / max);
                  return (
                    <button
                      key={cell.month}
                      type="button"
                      className={`history-trend__cell${cell.inRange ? "" : " is-out"}`}
                      disabled={!cell.inRange}
                      aria-label={
                        cell.inRange
                          ? `${cell.month} ${format(cell.value)}`
                          : `${cell.month} 不在当前区间`
                      }
                      style={
                        cell.inRange
                          ? ({
                              "--cell-intensity": intensity.toFixed(3),
                            } as CSSProperties)
                          : undefined
                      }
                      onMouseEnter={() => cell.inRange && setActiveMonth(cell.month)}
                      onFocus={() => cell.inRange && setActiveMonth(cell.month)}
                    />
                  );
                })}
              </div>
              <span className="history-trend__year-sum">{format(yearTotal)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
