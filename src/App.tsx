import { CSSProperties, ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Currency = "CNY" | "HKD";
type SummaryMode = "split" | "merged";

type LedgerEntry = {
  amount: string;
  currency: Currency;
  note: string;
};

type LedgerData = Record<string, LedgerEntry[]>;

type ExchangeCache = {
  hkdToCny: number;
  updatedAt: number;
  source: string;
};

const CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "居住",
  "通讯",
  "娱乐",
  "医疗",
  "教育",
  "旅行",
  "其他",
];

const LEGACY_ROWS_PER_CATEGORY = 5;
const MAX_RECORDS_PER_CATEGORY = 15;
const DEFAULT_RATE = 1.09;
const STORAGE_KEY = "monthly-smart-ledger:v1";
const RATE_KEY = "monthly-smart-ledger:exchange";
const LAST_CURRENCY_KEY = "monthly-smart-ledger:last-currency";
const DAY_MS = 24 * 60 * 60 * 1000;
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

const makeBlankEntry = (currency: Currency): LedgerEntry => ({
  amount: "",
  currency,
  note: "",
});

const makeDayEntries = (currency: Currency): LedgerEntry[] =>
  Array.from({ length: CATEGORIES.length * MAX_RECORDS_PER_CATEGORY }, () => makeBlankEntry(currency));

const getToday = () => new Date().toISOString().slice(0, 10);

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const formatMonthDay = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
};

const parseAmount = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const formatMoney = (value: number, currency: Currency) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const convert = (amount: number, from: Currency, to: Currency, hkdToCny: number) => {
  if (from === to) return amount;
  return from === "HKD" ? amount * hkdToCny : amount / hkdToCny;
};

const getMonthKey = (date: string) => date.slice(0, 7);

const getWeekRange = (date: string) => {
  const [year, month, dayOfMonth] = date.split("-").map(Number);
  const current = new Date(year, month - 1, dayOfMonth);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDateKey(monday),
    end: formatDateKey(sunday),
  };
};

const isInRange = (date: string, start: string, end: string) => date >= start && date <= end;

const sanitizeEntry = (entry: Partial<LedgerEntry>, fallbackCurrency: Currency): LedgerEntry => ({
  amount: typeof entry.amount === "string" ? entry.amount : "",
  currency: entry.currency === "CNY" || entry.currency === "HKD" ? entry.currency : fallbackCurrency,
  note: typeof entry.note === "string" ? entry.note : "",
});

const hasEntryContent = (entry: LedgerEntry) => Boolean(entry.amount.trim() || entry.note.trim());

const getEntryIndex = (categoryIndex: number, rowIndex: number) => categoryIndex * MAX_RECORDS_PER_CATEGORY + rowIndex;

const getCategoryEntries = (entries: LedgerEntry[], categoryIndex: number) =>
  entries.slice(
    categoryIndex * MAX_RECORDS_PER_CATEGORY,
    categoryIndex * MAX_RECORDS_PER_CATEGORY + MAX_RECORDS_PER_CATEGORY,
  );

const normalizeStoredEntries = (entries: Partial<LedgerEntry>[] | undefined): LedgerEntry[] => {
  const source = Array.isArray(entries) ? entries : [];
  if (source.length <= CATEGORIES.length * LEGACY_ROWS_PER_CATEGORY) {
    const normalized = makeDayEntries("CNY");
    CATEGORIES.forEach((_, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < LEGACY_ROWS_PER_CATEGORY; rowIndex += 1) {
        const legacyIndex = categoryIndex * LEGACY_ROWS_PER_CATEGORY + rowIndex;
        normalized[getEntryIndex(categoryIndex, rowIndex)] = sanitizeEntry(source[legacyIndex] ?? {}, "CNY");
      }
    });
    return normalized;
  }
  return Array.from({ length: CATEGORIES.length * MAX_RECORDS_PER_CATEGORY }, (_, index) =>
    sanitizeEntry(source[index] ?? {}, "CNY"),
  );
};

const serializeLedger = (ledger: LedgerData) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(ledger).filter(([, entries]) => entries.some((entry) => hasEntryContent(entry))),
    ),
  );

const readStoredLedger = (): LedgerData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Partial<LedgerEntry>[]>;
    return Object.fromEntries(
      Object.entries(parsed).map(([date, entries]) => [date, normalizeStoredEntries(entries)]),
    );
  } catch {
    return {};
  }
};

const readStoredRate = (): ExchangeCache => {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) throw new Error("empty");
    const parsed = JSON.parse(raw) as ExchangeCache;
    if (!Number.isFinite(parsed.hkdToCny) || parsed.hkdToCny <= 0) throw new Error("bad rate");
    return parsed;
  } catch {
    return {
      hkdToCny: DEFAULT_RATE,
      updatedAt: Date.now(),
      source: "默认汇率",
    };
  }
};

const readLastCurrency = (): Currency => {
  const value = localStorage.getItem(LAST_CURRENCY_KEY);
  return value === "CNY" ? "CNY" : "HKD";
};

const getDefaultRowCounts = (entries: LedgerEntry[]) =>
  CATEGORIES.map((_, categoryIndex) => {
    const categoryEntries = getCategoryEntries(entries, categoryIndex);
    const lastContentIndex = categoryEntries.reduce(
      (lastIndex, entry, index) => (hasEntryContent(entry) ? index : lastIndex),
      -1,
    );
    return Math.max(1, lastContentIndex + 1);
  });

const getCurrencyLabel = (currency: Currency) => (currency === "CNY" ? "人民币 CNY" : "港币 HKD");

const getEntryTotals = (entries: LedgerEntry[], hkdToCny: number) =>
  entries.reduce(
    (acc, entry) => {
      const amount = parseAmount(entry.amount);
      acc[entry.currency] += amount;
      acc.asCny += convert(amount, entry.currency, "CNY", hkdToCny);
      acc.asHkd += convert(amount, entry.currency, "HKD", hkdToCny);
      return acc;
    },
    { CNY: 0, HKD: 0, asCny: 0, asHkd: 0 },
  );

const collectEntries = (ledger: LedgerData, predicate: (date: string) => boolean) =>
  Object.entries(ledger).flatMap(([date, entries]) =>
    predicate(date)
      ? entries.map((entry, index) => ({
          ...entry,
          date,
          category: CATEGORIES[Math.floor(index / MAX_RECORDS_PER_CATEGORY)],
        }))
      : [],
  );

const summarizeByCategory = (entries: Array<LedgerEntry & { category: string }>, hkdToCny: number) => {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const amount = parseAmount(entry.amount);
    if (!amount) continue;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + convert(amount, entry.currency, "CNY", hkdToCny));
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return CATEGORIES.map((category, index) => ({
    category,
    value: totals.get(category) ?? 0,
    percent: total ? ((totals.get(category) ?? 0) / total) * 100 : 0,
    color: PIE_COLORS[index],
  })).filter((item) => item.value > 0);
};

type CategorySummary = ReturnType<typeof summarizeByCategory>;

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

function PieChart({ summary, title }: { summary: CategorySummary; title: string }) {
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

function App() {
  const [selectedDate, setSelectedDate] = useState(getToday);
  const [ledger, setLedger] = useState<LedgerData>(() => readStoredLedger());
  const [lastCurrency, setLastCurrency] = useState<Currency>(() => readLastCurrency());
  const [exchange, setExchange] = useState<ExchangeCache>(() => readStoredRate());
  const [rateStatus, setRateStatus] = useState("汇率已就绪");
  const [expandedStats, setExpandedStats] = useState<"week" | "month" | null>("week");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("split");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("CNY");
  const [dailyDefaultCurrency, setDailyDefaultCurrency] = useState<Currency>("HKD");
  const [visibleRowCountsByDate, setVisibleRowCountsByDate] = useState<Record<string, number[]>>({});
  const [importMessage, setImportMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedEntries = ledger[selectedDate] ?? makeDayEntries(dailyDefaultCurrency);
  const monthKey = getMonthKey(selectedDate);
  const weekRange = getWeekRange(selectedDate);
  const visibleRowCounts = visibleRowCountsByDate[selectedDate] ?? getDefaultRowCounts(selectedEntries);
  const weekTitle = `${formatMonthDay(weekRange.start)}-${formatMonthDay(weekRange.end)} 本周统计`;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeLedger(ledger));
  }, [ledger]);

  useEffect(() => {
    localStorage.setItem(RATE_KEY, JSON.stringify(exchange));
  }, [exchange]);

  useEffect(() => {
    localStorage.setItem(LAST_CURRENCY_KEY, lastCurrency);
  }, [lastCurrency]);

  useEffect(() => {
    const stale = Date.now() - exchange.updatedAt > DAY_MS;
    if (stale) {
      setRateStatus("汇率缓存已超过 24 小时，可手动刷新；当前仍使用缓存/默认汇率。");
    }
  }, [exchange.updatedAt]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setDailyDefaultCurrency("HKD");
  };

  const updateEntry = (index: number, patch: Partial<LedgerEntry>) => {
    setLedger((current) => {
      const entries = current[selectedDate] ? [...current[selectedDate]] : makeDayEntries(dailyDefaultCurrency);
      entries[index] = sanitizeEntry({ ...entries[index], ...patch }, dailyDefaultCurrency);
      return { ...current, [selectedDate]: entries };
    });
    if (patch.currency) setLastCurrency(patch.currency);
  };

  const dayTotals = useMemo(() => getEntryTotals(selectedEntries, exchange.hkdToCny), [selectedEntries, exchange.hkdToCny]);

  const categoryTotals = useMemo(
    () =>
      CATEGORIES.map((category, categoryIndex) => {
        const entries = getCategoryEntries(selectedEntries, categoryIndex);
        return { category, ...getEntryTotals(entries, exchange.hkdToCny) };
      }),
    [selectedEntries, exchange.hkdToCny],
  );

  const weekEntries = useMemo(
    () => collectEntries(ledger, (date) => isInRange(date, weekRange.start, weekRange.end)),
    [ledger, weekRange.start, weekRange.end],
  );

  const monthEntries = useMemo(
    () => collectEntries(ledger, (date) => getMonthKey(date) === monthKey),
    [ledger, monthKey],
  );

  const weekTotals = useMemo(() => getEntryTotals(weekEntries, exchange.hkdToCny), [weekEntries, exchange.hkdToCny]);
  const monthTotals = useMemo(() => getEntryTotals(monthEntries, exchange.hkdToCny), [monthEntries, exchange.hkdToCny]);
  const weekCategorySummary = useMemo(
    () => summarizeByCategory(weekEntries, exchange.hkdToCny),
    [weekEntries, exchange.hkdToCny],
  );
  const monthCategorySummary = useMemo(
    () => summarizeByCategory(monthEntries, exchange.hkdToCny),
    [monthEntries, exchange.hkdToCny],
  );

  const refreshExchange = async () => {
    setRateStatus("正在刷新汇率...");
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/HKD");
      if (!response.ok) throw new Error("汇率服务无响应");
      const data = (await response.json()) as { rates?: Record<string, number> };
      const nextRate = data.rates?.CNY;
      if (!Number.isFinite(nextRate) || !nextRate) throw new Error("汇率数据格式异常");
      setExchange({
        hkdToCny: nextRate,
        updatedAt: Date.now(),
        source: "open.er-api.com",
      });
      setRateStatus("汇率已刷新并缓存 24 小时。");
    } catch (error) {
      setRateStatus(
        `刷新失败，继续使用 ${exchange.source} 汇率 ${exchange.hkdToCny.toFixed(4)}。${error instanceof Error ? error.message : ""}`,
      );
    }
  };

  const handleAmountChange = (index: number, value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      updateEntry(index, { amount: value });
    }
  };

  const switchDailyDefaultCurrency = (currency: Currency) => {
    setDailyDefaultCurrency(currency);
    setLedger((current) => {
      const entries = current[selectedDate];
      if (!entries) return current;
      let hasChanges = false;
      const nextEntries = entries.map((entry) => {
        if (hasEntryContent(entry) || entry.currency === currency) return entry;
        hasChanges = true;
        return { ...entry, currency };
      });
      return hasChanges ? { ...current, [selectedDate]: nextEntries } : current;
    });
  };

  const updateVisibleRowCount = (categoryIndex: number, rowCount: number) => {
    setVisibleRowCountsByDate((current) => {
      const counts = [...(current[selectedDate] ?? getDefaultRowCounts(selectedEntries))];
      counts[categoryIndex] = Math.max(1, Math.min(MAX_RECORDS_PER_CATEGORY, rowCount));
      return { ...current, [selectedDate]: counts };
    });
  };

  const addCategoryRecord = (categoryIndex: number) => {
    const nextRowIndex = visibleRowCounts[categoryIndex];
    if (nextRowIndex >= MAX_RECORDS_PER_CATEGORY) return;
    updateVisibleRowCount(categoryIndex, nextRowIndex + 1);
    const nextIndex = getEntryIndex(categoryIndex, nextRowIndex);
    setLedger((current) => {
      const entries = current[selectedDate] ? [...current[selectedDate]] : makeDayEntries(dailyDefaultCurrency);
      entries[nextIndex] = makeBlankEntry(dailyDefaultCurrency);
      return { ...current, [selectedDate]: entries };
    });
    focusCell(selectedDate, nextIndex);
  };

  const deleteCategoryRecord = (categoryIndex: number, rowIndex: number) => {
    const currentRowCount = visibleRowCounts[categoryIndex];
    if (currentRowCount <= 1) return;
    setLedger((current) => {
      const entries = current[selectedDate] ? [...current[selectedDate]] : makeDayEntries(dailyDefaultCurrency);
      const categoryEntries = getCategoryEntries(entries, categoryIndex);
      const nextCategoryEntries = categoryEntries.filter((_, index) => index !== rowIndex);
      nextCategoryEntries.push(makeBlankEntry(dailyDefaultCurrency));
      nextCategoryEntries.slice(0, MAX_RECORDS_PER_CATEGORY).forEach((entry, index) => {
        entries[getEntryIndex(categoryIndex, index)] = entry;
      });
      return { ...current, [selectedDate]: entries };
    });
    updateVisibleRowCount(categoryIndex, currentRowCount - 1);
    focusCell(selectedDate, getEntryIndex(categoryIndex, Math.max(0, rowIndex - 1)));
  };

  const focusCell = (date: string, index: number, field: keyof LedgerEntry = "amount") => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-date="${date}"][data-index="${index}"][data-field="${field}"]`)?.focus();
    });
  };

  const moveFocus = (index: number, direction: "next" | "up" | "down") => {
    if (direction === "next") {
      focusCell(selectedDate, Math.min(index + 1, CATEGORIES.length * MAX_RECORDS_PER_CATEGORY - 1));
      return;
    }
    const offset = direction === "up" ? -MAX_RECORDS_PER_CATEGORY : MAX_RECORDS_PER_CATEGORY;
    const nextIndex = Math.max(0, Math.min(index + offset, CATEGORIES.length * MAX_RECORDS_PER_CATEGORY - 1));
    focusCell(selectedDate, nextIndex);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, index: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      moveFocus(index, "next");
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(index, "up");
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(index, "down");
    }
  };

  const exportCsv = () => {
    const rows = [["date", "category", "slot", "amount", "currency", "note"]];
    Object.entries(ledger)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, entries]) => {
        entries.forEach((entry, index) => {
          if (!entry.amount && !entry.note) return;
          rows.push([
            date,
            CATEGORIES[Math.floor(index / MAX_RECORDS_PER_CATEGORY)],
            String((index % MAX_RECORDS_PER_CATEGORY) + 1),
            entry.amount,
            entry.currency,
            entry.note,
          ]);
        });
      });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `智能记账本-${monthKey}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    const nextLedger = { ...ledger };
    let imported = 0;
    for (const line of lines.slice(1)) {
      const [date, category, slot, amount, currency, note] = parseCsvLine(line);
      const categoryIndex = CATEGORIES.indexOf(category);
      const rowIndex = Number(slot) - 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || categoryIndex < 0 || rowIndex < 0 || rowIndex >= MAX_RECORDS_PER_CATEGORY) continue;
      if (currency !== "CNY" && currency !== "HKD") continue;
      const entryIndex = getEntryIndex(categoryIndex, rowIndex);
      const entries = nextLedger[date] ? [...nextLedger[date]] : makeDayEntries(currency);
      entries[entryIndex] = sanitizeEntry({ amount, currency, note }, currency);
      nextLedger[date] = entries;
      imported += 1;
    }
    setLedger(nextLedger);
    setImportMessage(`已导入 ${imported} 条记录。`);
    event.target.value = "";
  };

  const clearCurrentMonth = () => {
    const confirmed = window.confirm(`确认清空 ${monthKey} 整个月的全部记账数据？此操作不可撤销。`);
    if (!confirmed) return;
    setLedger((current) =>
      Object.fromEntries(Object.entries(current).filter(([date]) => getMonthKey(date) !== monthKey)),
    );
    setVisibleRowCountsByDate((current) =>
      Object.fromEntries(Object.entries(current).filter(([date]) => getMonthKey(date) !== monthKey)),
    );
    setImportMessage(`${monthKey} 数据已清空。`);
  };

  const clearCurrentDay = () => {
    const confirmed = window.confirm(`确认清空 ${selectedDate} 当日的全部记账数据？此操作不可撤销。`);
    if (!confirmed) return;
    setLedger((current) => {
      const { [selectedDate]: _removed, ...rest } = current;
      return rest;
    });
    setVisibleRowCountsByDate((current) => {
      const { [selectedDate]: _removed, ...rest } = current;
      return rest;
    });
    setImportMessage(`${selectedDate} 当日数据已清空。`);
  };

  const renderStatsCard = (
    title: string,
    range: string,
    totals: ReturnType<typeof getEntryTotals>,
    summary: ReturnType<typeof summarizeByCategory>,
    type: "week" | "month",
  ) => {
    return (
      <section className="card stats-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">{range}</p>
            <h2>{title}</h2>
          </div>
          <button className="ghost-button" onClick={() => setExpandedStats(expandedStats === type ? null : type)}>
            {expandedStats === type ? "收起" : "展开"}
          </button>
        </div>
        <div className="totals-grid">
          <div>
            <span>人民币口径</span>
            <strong>{formatMoney(totals.asCny, "CNY")}</strong>
          </div>
          <div>
            <span>港币口径</span>
            <strong>{formatMoney(totals.asHkd, "HKD")}</strong>
          </div>
        </div>
        <div className="chart-row">
          <PieChart summary={summary} title={title} />
          <div className="legend">
            {summary.length ? (
              summary.map((item) => (
                <div key={item.category} className="legend-item">
                  <span style={{ backgroundColor: item.color }} />
                  <b>{item.category}</b>
                  <em>{item.percent.toFixed(1)}%</em>
                </div>
              ))
            ) : (
              <p className="muted">暂无支出数据</p>
            )}
          </div>
        </div>
        {expandedStats === type && (
          <div className="detail-list">
            {summary.map((item) => (
              <div key={item.category}>
                <span>{item.category}</span>
                <span>{formatMoney(item.value, "CNY")} · {item.percent.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  const monthlySummaryRows = CATEGORIES.map((category) => {
    const entries = monthEntries.filter((entry) => entry.category === category);
    const totals = getEntryTotals(entries, exchange.hkdToCny);
    return { category, totals };
  }).filter((row) => row.totals.CNY || row.totals.HKD);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">月度智能记账本</p>
          <h1 className="hero-title" data-text="把每一天的花费整理成清晰的数字">把每一天的花费整理成清晰的数字</h1>
          <p>支持人民币 / 港币双货币实时记账</p>
        </div>
        <div className="date-card">
          <label>
            记账日期
            <input type="date" value={selectedDate} onChange={(event) => handleDateChange(event.target.value)} />
          </label>
          <div className="rate-box">
            <div className="rate-info">
              <span>1 HKD = {exchange.hkdToCny.toFixed(4)} CNY</span>
              <small>{exchange.source} · {new Date(exchange.updatedAt).toLocaleString("zh-CN")}</small>
              <button onClick={refreshExchange}>刷新汇率</button>
            </div>
            <div className="daily-default-controls">
              <span className="control-label">今日默认货币</span>
              <div className="currency-switch" data-selected={dailyDefaultCurrency} role="group" aria-label="今日默认货币">
                {(["HKD", "CNY"] as const).map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={dailyDefaultCurrency === currency ? "currency-switch-option active" : "currency-switch-option"}
                    onClick={() => switchDailyDefaultCurrency(currency)}
                    aria-pressed={dailyDefaultCurrency === currency}
                  >
                    {currency}
                  </button>
                ))}
              </div>
              <strong className="currency-badge">当前：{getCurrencyLabel(dailyDefaultCurrency)}</strong>
            </div>
          </div>
          <p className="status">{rateStatus}</p>
        </div>
      </header>

      <section className="card ledger-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">每日明细</p>
            <h2>{selectedDate} 日记账</h2>
          </div>
          <div className="daily-total">
            <span>当日总支出</span>
            <strong>{formatMoney(dayTotals.asCny, "CNY")} / {formatMoney(dayTotals.asHkd, "HKD")}</strong>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>类目</th>
                <th>记录</th>
                <th>金额</th>
                <th>货币</th>
                <th>备注</th>
                <th>操作</th>
                <th>类目当日小计</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((category, categoryIndex) =>
                Array.from({ length: visibleRowCounts[categoryIndex] }, (_, rowIndex) => {
                  const index = getEntryIndex(categoryIndex, rowIndex);
                  const entry = selectedEntries[index] ?? makeBlankEntry(dailyDefaultCurrency);
                  const categoryTotal = categoryTotals[categoryIndex];
                  const currentRowCount = visibleRowCounts[categoryIndex];
                  const canAdd = currentRowCount < MAX_RECORDS_PER_CATEGORY;
                  return (
                    <tr key={`${category}-${rowIndex}`}>
                      {rowIndex === 0 && (
                        <th rowSpan={currentRowCount} className="category-cell">
                          <span>{category}</span>
                          <button
                            className="add-record-button"
                            onClick={() => addCategoryRecord(categoryIndex)}
                            disabled={!canAdd}
                            title={canAdd ? "添加记录" : `已达上限 (${MAX_RECORDS_PER_CATEGORY} 条)`}
                            aria-label={
                              canAdd
                                ? `添加${category}记录`
                                : `${category}已达上限 (${MAX_RECORDS_PER_CATEGORY} 条)`
                            }
                          >
                            +
                          </button>
                        </th>
                      )}
                      <td className="slot-cell">#{rowIndex + 1}</td>
                      <td>
                        <input
                          data-date={selectedDate}
                          data-index={index}
                          data-field="amount"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={entry.amount}
                          onChange={(event) => handleAmountChange(index, event.target.value)}
                          onKeyDown={(event) => handleKeyDown(event, index)}
                          className={entry.amount && parseAmount(entry.amount) === 0 ? "invalid" : ""}
                        />
                      </td>
                      <td>
                        <select
                          data-date={selectedDate}
                          data-index={index}
                          data-field="currency"
                          value={entry.currency}
                          onChange={(event) => updateEntry(index, { currency: event.target.value as Currency })}
                          onKeyDown={(event) => handleKeyDown(event, index)}
                        >
                          <option value="CNY">CNY</option>
                          <option value="HKD">HKD</option>
                        </select>
                      </td>
                      <td>
                        <input
                          data-date={selectedDate}
                          data-index={index}
                          data-field="note"
                          placeholder="备注"
                          value={entry.note}
                          onChange={(event) => updateEntry(index, { note: event.target.value })}
                          onKeyDown={(event) => handleKeyDown(event, index)}
                        />
                      </td>
                      <td className="record-actions">
                        <button
                          className="delete-record-button"
                          title="删除记录"
                          aria-label={`删除${category}第${rowIndex + 1}条记录`}
                          onClick={() => deleteCategoryRecord(categoryIndex, rowIndex)}
                          disabled={currentRowCount <= 1}
                        >
                          ×
                        </button>
                      </td>
                      {rowIndex === 0 && (
                        <td rowSpan={currentRowCount} className="subtotal-cell">
                          <strong>{formatMoney(categoryTotal.asCny, "CNY")}</strong>
                          <span>{formatMoney(categoryTotal.asHkd, "HKD")}</span>
                        </td>
                      )}
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="stats-grid">
        {renderStatsCard(
          weekTitle,
          "自然周（周一至周日）",
          weekTotals,
          weekCategorySummary,
          "week",
        )}
        {renderStatsCard("本月统计", monthKey, monthTotals, monthCategorySummary, "month")}
      </div>

      <section className="card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">月度总结</p>
            <h2>{monthKey} 汇总</h2>
          </div>
          <button className="ghost-button" onClick={() => setSummaryOpen(!summaryOpen)}>
            {summaryOpen ? "收起" : "展开"}
          </button>
        </div>
        {summaryOpen && (
          <>
            <div className="summary-controls">
              <label>
                汇总模式
                <select value={summaryMode} onChange={(event) => setSummaryMode(event.target.value as SummaryMode)}>
                  <option value="split">原货币分开</option>
                  <option value="merged">单一货币合并</option>
                </select>
              </label>
              <label>
                基准货币
                <select value={baseCurrency} onChange={(event) => setBaseCurrency(event.target.value as Currency)}>
                  <option value="CNY">CNY</option>
                  <option value="HKD">HKD</option>
                </select>
              </label>
            </div>
            <div className="summary-list">
              {monthlySummaryRows.length ? (
                monthlySummaryRows.map(({ category, totals }) => (
                  <div key={category}>
                    <span>{category}</span>
                    {summaryMode === "split" ? (
                      <strong>{formatMoney(totals.CNY, "CNY")} / {formatMoney(totals.HKD, "HKD")}</strong>
                    ) : (
                      <strong>{formatMoney(baseCurrency === "CNY" ? totals.asCny : totals.asHkd, baseCurrency)}</strong>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">本月还没有可汇总的支出。</p>
              )}
            </div>
          </>
        )}
      </section>

      <section className="card data-card">
        <div>
          <p className="eyebrow">数据管理</p>
          <h2>导入、导出与清理</h2>
          <p className="muted">CSV 导入会按日期、类目和序号覆盖对应格子，其他数据保持不变。</p>
          {importMessage && <p className="status">{importMessage}</p>}
        </div>
        <div className="action-row">
          <button onClick={exportCsv}>导出 CSV</button>
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}>导入 CSV</button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
        </div>
        <div className="danger-zone" aria-label="危险数据操作">
          <button className="danger-button" onClick={clearCurrentDay}>清空当日数据</button>
          <button className="danger-button" onClick={clearCurrentMonth}>清空当月数据</button>
        </div>
      </section>
    </main>
  );
}

export default App;
