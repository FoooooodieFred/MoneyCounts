import { useMemo } from "react";
import {
  extremeBarDates,
  metricForBar,
  metricForNet,
  type DashboardCategoryRow,
  type DashboardDayBar,
  type DashboardFlow,
  type DashboardNetPoint,
  type NetWorthSeries,
} from "../lib/statsDashboard";

type BarChartProps = {
  rows: DashboardDayBar[];
  flow: DashboardFlow;
  average: number;
  formatValue: (value: number) => string;
};

export function DailyFlowBarChart({ rows, flow, average, formatValue }: BarChartProps) {
  const extremes = useMemo(() => extremeBarDates(rows, flow), [rows, flow]);
  const values = rows.map((row) => metricForBar(row, flow));
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)), Math.abs(average));
  const width = 640;
  const height = 220;
  const padX = 28;
  const padY = 18;
  const chartH = height - padY * 2;
  const chartW = width - padX * 2;
  const gap = rows.length > 20 ? 2 : 4;
  const barW = Math.max(
    4,
    (chartW - gap * Math.max(0, rows.length - 1)) / Math.max(1, rows.length),
  );
  const zeroY = padY + (maxAbs / (maxAbs * 2)) * chartH;
  const avgY = padY + ((maxAbs - average) / (maxAbs * 2)) * chartH;

  if (!rows.length) {
    return <p className="muted">这个月还没有可绘制的收支。</p>;
  }

  return (
    <svg
      className="stats-bar-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="每日收支柱状图"
    >
      <line className="stats-chart__axis" x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} />
      <line
        className="stats-chart__average"
        x1={padX}
        y1={avgY}
        x2={width - padX}
        y2={avgY}
        strokeDasharray="5 5"
      />
      {rows.map((row, index) => {
        const value = metricForBar(row, flow);
        const x = padX + index * (barW + gap);
        const h = (Math.abs(value) / (maxAbs * 2)) * chartH;
        const y = value >= 0 ? zeroY - h : zeroY;
        const extreme = extremes.has(row.date);
        return (
          <g key={row.date}>
            <rect
              className={`stats-bar${value < 0 ? " is-neg" : ""}${extreme ? " is-extreme" : ""}`}
              x={x}
              y={y}
              width={barW}
              height={Math.max(value === 0 ? 0 : 2, h)}
              rx="3"
            >
              <title>
                {row.date} {formatValue(value)}
              </title>
            </rect>
            {row.day === 1 || row.day % 5 === 0 || row.day === rows.length ? (
              <text className="stats-chart__tick" x={x + barW / 2} y={height - 4}>
                {row.day}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

type DonutProps = {
  rows: DashboardCategoryRow[];
  total: number;
  formatValue: (value: number) => string;
};

const polar = (cx: number, cy: number, r: number, angle: number) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const slicePath = (cx: number, cy: number, r: number, start: number, end: number) => {
  const a = polar(cx, cy, r, end);
  const b = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 0 ${b.x} ${b.y}`;
};

export function CategoryDonut({ rows, total, formatValue }: DonutProps) {
  const size = 220;
  const cx = 110;
  const cy = 110;
  const outer = 84;
  const inner = 52;
  let cursor = 0;
  const totalParts = formatValue(total).trim().split(/\s+/);
  const totalUnit = totalParts.length > 1 ? totalParts.at(-1) : "";
  const totalAmount =
    totalParts.length > 1 ? totalParts.slice(0, -1).join(" ") : formatValue(total);

  if (!rows.length) {
    return (
      <div className="stats-donut stats-donut--empty">
        <p className="muted">暂无分类支出</p>
      </div>
    );
  }

  return (
    <div className="stats-donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="支出分类占比">
        {rows.map((row, index) => {
          const start = (cursor / 100) * 360;
          cursor += row.percent;
          const end = (cursor / 100) * 360;
          const color = `hsl(${(index * 37) % 360} 42% 62%)`;
          return row.percent >= 99.999 ? (
            <circle key={row.category} cx={cx} cy={cy} r={outer} fill={color} />
          ) : (
            <path
              key={row.category}
              d={`${slicePath(cx, cy, outer, start, end)} L ${cx} ${cy} Z`}
              fill={color}
            >
              <title>
                {row.category} {row.percent.toFixed(1)}%
              </title>
            </path>
          );
        })}
        <circle cx={cx} cy={cy} r={inner} className="stats-donut__hole" />
        <text className="stats-donut__center-label" x={cx} y={cy - 10}>
          支出
        </text>
        <text className="stats-donut__center-value" x={cx} y={totalUnit ? cy + 8 : cy + 14}>
          {totalAmount}
        </text>
        {totalUnit ? (
          <text className="stats-donut__center-label" x={cx} y={cy + 24}>
            {totalUnit}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

type LineProps = {
  rows: DashboardNetPoint[];
  series: NetWorthSeries;
  formatValue: (value: number) => string;
};

const niceStep = (raw: number) => {
  const value = Math.max(Math.abs(raw), 1e-6);
  const exp = Math.floor(Math.log10(value));
  const frac = value / 10 ** exp;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * 10 ** exp;
};

const yScale = (min: number, max: number) => {
  if (min === max) {
    const pad = Math.max(1, Math.abs(max) * 0.2);
    return { min: min - pad, max: max + pad, ticks: [min - pad, min, min + pad] };
  }
  const step = niceStep((max - min) / 4);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.5; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return { min: start, max: end, ticks };
};

const axisNumber = (value: number) => {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  const body = abs.toLocaleString("zh-CN", {
    maximumFractionDigits: abs >= 100 ? 0 : 2,
  });
  return value < 0 ? `−${body}` : body;
};

export function NetWorthLineChart({ rows, series, formatValue }: LineProps) {
  if (!rows.length) return <p className="muted">还没有净资产轨迹。</p>;

  const values = rows.map((row) => metricForNet(row, series));
  const scale = yScale(Math.min(0, ...values), Math.max(0, ...values));
  const span = scale.max - scale.min || 1;
  const width = 720;
  const height = 240;
  const yLabels = scale.ticks.map(axisNumber);
  const padLeft = Math.max(48, 12 + Math.max(...yLabels.map((label) => label.length)) * 7);
  const plot = { left: padLeft, right: width - 16, top: 18, bottom: height - 32 };
  const toX = (index: number) =>
    rows.length <= 1
      ? (plot.left + plot.right) / 2
      : plot.left + (index / (rows.length - 1)) * (plot.right - plot.left);
  const toY = (value: number) =>
    plot.top + ((scale.max - value) / span) * (plot.bottom - plot.top);
  const line = rows
    .map(
      (row, index) =>
        `${index === 0 ? "M" : "L"} ${toX(index).toFixed(1)} ${toY(metricForNet(row, series)).toFixed(1)}`,
    )
    .join(" ");
  const area = rows.length
    ? [
        `M ${toX(0).toFixed(1)} ${toY(0).toFixed(1)}`,
        ...rows.map(
          (row, index) => `L ${toX(index).toFixed(1)} ${toY(metricForNet(row, series)).toFixed(1)}`,
        ),
        `L ${toX(rows.length - 1).toFixed(1)} ${toY(0).toFixed(1)}`,
        "Z",
      ].join(" ")
    : "";
  const xTicks = rows.filter(
    (row, index) =>
      index === 0 ||
      index === rows.length - 1 ||
      Number(row.date.slice(-2)) % 5 === 0,
  );

  return (
    <svg
      className="stats-line-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="净资产趋势"
    >
      {scale.ticks.map((tick, tickIndex) => (
        <g key={`${tick}-${tickIndex}`}>
          <line
            className="stats-chart__grid"
            x1={plot.left}
            y1={toY(tick)}
            x2={plot.right}
            y2={toY(tick)}
          />
          <line
            className="stats-chart__tickmark"
            x1={plot.left - 4}
            y1={toY(tick)}
            x2={plot.left}
            y2={toY(tick)}
          />
          <text className="stats-chart__tick stats-chart__tick--y" x={plot.left - 8} y={toY(tick) + 3}>
            {axisNumber(tick)}
          </text>
        </g>
      ))}
      <line
        className="stats-chart__frame"
        x1={plot.left}
        y1={plot.top}
        x2={plot.left}
        y2={plot.bottom}
      />
      <line
        className="stats-chart__frame"
        x1={plot.left}
        y1={plot.bottom}
        x2={plot.right}
        y2={plot.bottom}
      />
      <path className="stats-line-chart__area" d={area} />
      <path className="stats-line-chart__line" d={line} />
      {xTicks.map((row) => {
        const index = rows.indexOf(row);
        const x = toX(index);
        return (
          <g key={row.date}>
            <line
              className="stats-chart__tickmark"
              x1={x}
              y1={plot.bottom}
              x2={x}
              y2={plot.bottom + 4}
            />
            <text className="stats-chart__tick stats-chart__tick--x" x={x} y={height - 8}>
              {Number(row.date.slice(-2))}
            </text>
          </g>
        );
      })}
      {rows.length <= 31
        ? rows.map((row, index) => (
            <circle
              key={row.date}
              className="stats-line-chart__dot"
              cx={toX(index)}
              cy={toY(metricForNet(row, series))}
              r="3"
            >
              <title>
                {row.date} {formatValue(metricForNet(row, series))}
              </title>
            </circle>
          ))
        : null}
    </svg>
  );
}
