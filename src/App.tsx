import {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import {
  LocalLedgerRecord,
  parseNaturalLedger,
} from "./localLedgerParser";
import {
  TravelHistoryDetailModal,
  TravelHistoryPanel,
  TravelMergeModal,
  buildMergeDefaults,
} from "./TravelHistoryUI";
import {
  DEFAULT_TRAVEL_STATE,
  TravelHistoryRecord,
  TravelState,
  buildBillNameFromLocation,
  buildFallbackBillName,
  detectTravelGeo,
  mergeTravelHistoryRecords,
  PENDING_DELETE_TTL_MS,
  PendingTravelHistoryDelete,
  purgeExpiredPendingDeletes,
  readStoredPendingTravelDeletes,
  readStoredTravelHistory,
  readStoredTravelState,
  TRAVEL_HISTORY_KEY,
  TRAVEL_HISTORY_PENDING_DELETE_KEY,
  TRAVEL_KEY,
} from "./travelMode";

type Currency = string;
type ApiCurrency = string;
type SummaryMode = "split" | "merged";
type ThemeMode = "light" | "dark";

type LedgerEntry = {
  amount: string;
  currency: Currency;
  note: string;
  hidden?: boolean;
};

type LedgerData = Record<string, LedgerEntry[]>;
type EditableField = "amount" | "note";
type PreviewField = keyof Pick<LocalLedgerRecord, "date" | "category" | "amount" | "currency" | "note">;
type FunDataCard = {
  id: string;
  title: string;
  value: string;
  hint: string;
  variant: string;
  effect: "float" | "tilt" | "pulse" | "spark" | "orbit" | "flip";
  accent: string;
};

type ExchangeCache = {
  base: "USD";
  rates: Record<ApiCurrency, number>;
  updatedAt: number;
  source: string;
};

type BackupReminderState = {
  dismissedAt: number;
  permanent?: boolean;
};

type CurrencyModalState =
  | { type: "daily-default" }
  | { type: "entry"; index: number; category: string; rowIndex: number }
  | null;

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
const STORAGE_KEY = "monthly-smart-ledger:v1";
const RATE_KEY = "monthly-smart-ledger:exchange";
const LAST_CURRENCY_KEY = "monthly-smart-ledger:last-currency";
const STATS_CURRENCIES_KEY = "monthly-smart-ledger:stats-currencies";
const CUSTOM_CURRENCIES_KEY = "monthly-smart-ledger:custom-currencies";
const THEME_KEY = "monthly-smart-ledger:theme";
const BACKUP_REMINDER_KEY = "monthly-smart-ledger:backup-reminder";
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_REMINDER_COOLDOWN_MS = 7 * DAY_MS;
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

const PRIMARY_CURRENCIES = ["HKD", "CNY"] as const;
const OTHER_CURRENCIES = ["USD", "MOP", "JPY", "EUR", "KRW", "THB", "SGD", "NTD", "NZD", "GBP", "AUD"] as const;
const DEFAULT_CURRENCIES = [...PRIMARY_CURRENCIES, ...OTHER_CURRENCIES] as const;
const EDITABLE_FIELDS = ["amount", "note"] as const satisfies readonly EditableField[];

const CURRENCY_META: Record<string, { name: string; shortName: string; apiCode: ApiCurrency; symbol: string }> = {
  HKD: { name: "港币", shortName: "港币", apiCode: "HKD", symbol: "HK$" },
  CNY: { name: "人民币", shortName: "人民币", apiCode: "CNY", symbol: "¥" },
  USD: { name: "美元", shortName: "美元", apiCode: "USD", symbol: "$" },
  MOP: { name: "澳门元", shortName: "澳门元", apiCode: "MOP", symbol: "MOP$" },
  JPY: { name: "日元", shortName: "日元", apiCode: "JPY", symbol: "¥" },
  EUR: { name: "欧元", shortName: "欧元", apiCode: "EUR", symbol: "€" },
  KRW: { name: "韩元", shortName: "韩元", apiCode: "KRW", symbol: "₩" },
  THB: { name: "泰铢", shortName: "泰铢", apiCode: "THB", symbol: "฿" },
  SGD: { name: "新加坡元", shortName: "新元", apiCode: "SGD", symbol: "S$" },
  NTD: { name: "新台币", shortName: "新台币", apiCode: "TWD", symbol: "NT$" },
  NZD: { name: "新西兰元", shortName: "纽元", apiCode: "NZD", symbol: "NZ$" },
  GBP: { name: "英镑", shortName: "英镑", apiCode: "GBP", symbol: "£" },
  AUD: { name: "澳元", shortName: "澳元", apiCode: "AUD", symbol: "A$" },
};

const COMMON_ISO_4217_CODES = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN", "BAM", "BBD", "BDT", "BGN", "BHD",
  "BIF", "BMD", "BND", "BOB", "BRL", "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP", "ERN", "ETB", "EUR", "FJD", "FKP",
  "GBP", "GEL", "GHS", "GIP", "GMD", "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS",
  "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF", "KRW", "KWD", "KYD", "KZT",
  "LAK", "LBP", "LKR", "LRD", "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR",
  "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR", "NTD", "NZD", "OMR", "PAB", "PEN",
  "PGK", "PHP", "PKR", "PLN", "PYG", "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK",
  "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS", "TMT", "TND", "TOP", "TRY",
  "TTD", "TWD", "TZS", "UAH", "UGX", "USD", "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XOF",
  "XPF", "YER", "ZAR", "ZMW",
]);

const DEFAULT_USD_RATES: Record<ApiCurrency, number> = {
  USD: 1,
  HKD: 7.82,
  CNY: 7.24,
  MOP: 8.05,
  JPY: 157,
  EUR: 0.92,
  KRW: 1375,
  THB: 36.6,
  SGD: 1.35,
  TWD: 32.4,
  NZD: 1.64,
  GBP: 0.78,
  AUD: 1.51,
};

const makeBlankEntry = (currency: Currency): LedgerEntry => ({
  amount: "",
  currency,
  note: "",
  hidden: false,
});

const makeDayEntries = (currency: Currency): LedgerEntry[] =>
  Array.from({ length: CATEGORIES.length * MAX_RECORDS_PER_CATEGORY }, () => makeBlankEntry(currency));

const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getToday = () => formatDateKey(new Date());

const parseDateKey = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const isValidDateKey = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = parseDateKey(date);
  const [year, month, day] = date.split("-").map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
};

const shiftDateKey = (date: string, offset: number) => {
  const next = parseDateKey(date);
  next.setDate(next.getDate() + offset);
  return formatDateKey(next);
};

const formatMonthDay = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
};

const formatWeekday = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(parseDateKey(date));

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const hashSeed = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pickStableItems = <T extends { id: string }>(items: readonly T[], seed: string, count: number) =>
  [...items]
    .map((item, index) => ({
      item,
      rank: hashSeed(`${seed}:${item.id}:${index}`),
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count)
    .map(({ item }) => item);

const parseAmount = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : 0;
};

const normalizeCurrencyCode = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const getApiCode = (currency: Currency) => (currency === "NTD" ? "TWD" : currency);

const getCurrencyMeta = (currency: Currency) =>
  CURRENCY_META[currency] ?? {
    name: `${currency} 货币`,
    shortName: currency,
    apiCode: getApiCode(currency),
    symbol: `${currency} `,
  };

const getCurrencyLabel = (currency: Currency) => `${getCurrencyMeta(currency).name} ${currency}`;

const normalizeStoredCustomCurrencies = (items: unknown): Currency[] => {
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .map(normalizeCurrencyCode)
        .map((currency) => (currency === "TWD" ? "NTD" : currency))
        .filter((currency) => /^[A-Z]{3}$/.test(currency) && COMMON_ISO_4217_CODES.has(currency)),
    ),
  ).filter((currency) => !(DEFAULT_CURRENCIES as readonly string[]).includes(currency));
};

const readStoredCustomCurrencies = () => {
  try {
    return normalizeStoredCustomCurrencies(JSON.parse(localStorage.getItem(CUSTOM_CURRENCIES_KEY) ?? "[]"));
  } catch {
    return [];
  }
};

const getKnownCurrencies = () => [...DEFAULT_CURRENCIES, ...readStoredCustomCurrencies()];

const isCurrency = (value: unknown): value is Currency =>
  typeof value === "string" && getKnownCurrencies().includes(value);

const normalizeCurrencyInput = (value: unknown): Currency | null => {
  const currency = normalizeCurrencyCode(value);
  if (currency === "TWD") return "NTD";
  return isCurrency(currency) ? currency : null;
};

const isPrimaryCurrency = (currency: Currency): currency is (typeof PRIMARY_CURRENCIES)[number] =>
  (PRIMARY_CURRENCIES as readonly Currency[]).includes(currency);

const formatMoney = (value: number, currency: Currency) => {
  const formatted = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${getCurrencyMeta(currency).symbol}${formatted} ${currency}`;
};

const normalizeRates = (
  rates: Partial<Record<ApiCurrency, number>> | undefined,
  currencies: readonly Currency[] = getKnownCurrencies(),
): Record<ApiCurrency, number> =>
  Array.from(new Set(currencies.map(getApiCode))).reduce(
    (acc, code) => {
      const rate = rates?.[code];
      acc[code] = Number.isFinite(rate) && rate && rate > 0 ? rate : DEFAULT_USD_RATES[code] ?? 1;
      return acc;
    },
    { ...DEFAULT_USD_RATES },
  );

const convert = (amount: number, from: Currency, to: Currency, exchange: ExchangeCache) => {
  if (from === to) return amount;
  const fromRate = exchange.rates[getApiCode(from)] ?? DEFAULT_USD_RATES[getApiCode(from)] ?? 1;
  const toRate = exchange.rates[getApiCode(to)] ?? DEFAULT_USD_RATES[getApiCode(to)] ?? 1;
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
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
  currency: normalizeCurrencyInput(entry.currency) ?? fallbackCurrency,
  note: typeof entry.note === "string" ? entry.note : "",
  hidden: entry.hidden === true,
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
    const parsed = JSON.parse(raw) as Partial<ExchangeCache> & { hkdToCny?: number };
    if (Number.isFinite(parsed.hkdToCny) && parsed.hkdToCny && parsed.hkdToCny > 0) {
      return {
        base: "USD",
        rates: normalizeRates({
          ...DEFAULT_USD_RATES,
          CNY: DEFAULT_USD_RATES.HKD * parsed.hkdToCny,
        }),
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        source: parsed.source ? `${parsed.source}（旧缓存已迁移）` : "旧汇率缓存已迁移",
      };
    }
    const rates = normalizeRates(parsed.rates);
    return {
      base: "USD",
      rates,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
      source: typeof parsed.source === "string" ? parsed.source : "缓存汇率",
    };
  } catch {
    return {
      base: "USD",
      rates: DEFAULT_USD_RATES,
      updatedAt: Date.now(),
      source: "默认汇率",
    };
  }
};

const readLastCurrency = (): Currency => {
  const value = localStorage.getItem(LAST_CURRENCY_KEY);
  return normalizeCurrencyInput(value) ?? "HKD";
};

const readStoredStatsCurrencies = (fallbackCurrency: Currency): Currency[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_CURRENCIES_KEY) ?? "[]") as unknown[];
    const currencies = parsed
      .map(normalizeCurrencyInput)
      .filter((currency): currency is Currency => Boolean(currency));
    return currencies.length ? currencies : [fallbackCurrency];
  } catch {
    return [fallbackCurrency];
  }
};

const readStoredTheme = (): ThemeMode => localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";

const readBackupReminderState = (): BackupReminderState | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(BACKUP_REMINDER_KEY) ?? "null") as Partial<BackupReminderState> | null;
    if (!parsed || typeof parsed.dismissedAt !== "number") return null;
    return { dismissedAt: parsed.dismissedAt, permanent: parsed.permanent === true };
  } catch {
    return null;
  }
};

const shouldShowBackupReminder = (state: BackupReminderState | null) => {
  if (!state) return true;
  if (state.permanent) return false;
  return Date.now() - state.dismissedAt > BACKUP_REMINDER_COOLDOWN_MS;
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

const emptyCurrencyTotals = (currencies: readonly Currency[]) =>
  currencies.reduce(
    (acc, currency) => {
      acc[currency] = 0;
      return acc;
    },
    {} as Record<Currency, number>,
  );

const getEntryTotals = (entries: LedgerEntry[], exchange: ExchangeCache, currencies: readonly Currency[]) =>
  entries.reduce(
    (acc, entry) => {
      if (entry.hidden) return acc;
      const amount = parseAmount(entry.amount);
      if (!amount) return acc;
      if (acc.native[entry.currency] === undefined) acc.native[entry.currency] = 0;
      acc.native[entry.currency] += amount;
      currencies.forEach((currency) => {
        acc.converted[currency] += convert(amount, entry.currency, currency, exchange);
      });
      return acc;
    },
    { native: emptyCurrencyTotals(currencies), converted: emptyCurrencyTotals(currencies) },
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

type EntryTotals = ReturnType<typeof getEntryTotals>;

const hasTotals = (totals: EntryTotals, currencies: readonly Currency[]) =>
  currencies.some((currency) => (totals.native[currency] ?? 0) !== 0);

const summarizeByCategory = (entries: Array<LedgerEntry & { category: string }>, exchange: ExchangeCache, baseCurrency: Currency) => {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.hidden) continue;
    const amount = parseAmount(entry.amount);
    if (!amount) continue;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + convert(amount, entry.currency, baseCurrency, exchange));
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + Math.abs(value), 0);
  return CATEGORIES.map((category, index) => ({
    category,
    value: totals.get(category) ?? 0,
    percent: total ? (Math.abs(totals.get(category) ?? 0) / total) * 100 : 0,
    color: PIE_COLORS[index],
  })).filter((item) => item.value !== 0);
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

function StatsExpandPanel({ open, children }: { open: boolean; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const panel = panelRef.current;
    const inner = innerRef.current;
    if (!panel || !inner) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        gsap.set(panel, {
          height: open ? "auto" : 0,
          autoAlpha: open ? 1 : 0,
          overflow: open ? "visible" : "hidden",
        });
        return;
      }

      if (reduceMotion) {
        gsap.set(panel, {
          height: open ? "auto" : 0,
          autoAlpha: open ? 1 : 0,
          overflow: open ? "visible" : "hidden",
        });
        return;
      }

      gsap.killTweensOf(panel);

      if (open) {
        gsap.set(panel, { height: "auto", overflow: "hidden" });
        const targetHeight = panel.offsetHeight;
        gsap.fromTo(
          panel,
          { height: 0, autoAlpha: 0 },
          {
            height: targetHeight,
            autoAlpha: 1,
            duration: 0.38,
            ease: "power2.out",
            overwrite: "auto",
            onComplete: () => {
              gsap.set(panel, { height: "auto", overflow: "visible" });
            },
          },
        );
        return;
      }

      const currentHeight = panel.offsetHeight;
      gsap.fromTo(
        panel,
        { height: currentHeight, autoAlpha: 1, overflow: "hidden" },
        {
          height: 0,
          autoAlpha: 0,
          duration: 0.3,
          ease: "power2.in",
          overwrite: "auto",
        },
      );
    }, panel);

    return () => ctx.revert();
  }, [open]);

  return (
    <div ref={panelRef} className={`stats-expand-panel${open ? " is-open" : ""}`} aria-hidden={!open}>
      <div ref={innerRef} className="detail-list">
        {children}
      </div>
    </div>
  );
}

function App() {
  const appRootRef = useRef<HTMLElement | null>(null);
  const modalRootRef = useRef<HTMLDivElement | null>(null);
  const naturalPreviewRef = useRef<HTMLDivElement | null>(null);
  const [selectedDate, setSelectedDate] = useState(getToday);
  const [ledger, setLedger] = useState<LedgerData>(() => readStoredLedger());
  const [customCurrencies, setCustomCurrencies] = useState<Currency[]>(() => readStoredCustomCurrencies());
  const [lastCurrency, setLastCurrency] = useState<Currency>(() => readLastCurrency());
  const [exchange, setExchange] = useState<ExchangeCache>(() => readStoredRate());
  const [rateStatus, setRateStatus] = useState("汇率已就绪");
  const [expandedStats, setExpandedStats] = useState<Record<"week" | "month", boolean>>({ week: true, month: true });
  const [summaryMode, setSummaryMode] = useState<SummaryMode>("split");
  const [baseCurrency, setBaseCurrency] = useState<Currency>("CNY");
  const [dailyDefaultCurrency, setDailyDefaultCurrency] = useState<Currency>("HKD");
  const [selectedStatsCurrencies, setSelectedStatsCurrencies] = useState<Currency[]>(() =>
    readStoredStatsCurrencies("HKD"),
  );
  const [currencyModal, setCurrencyModal] = useState<CurrencyModalState>(null);
  const [exchangeTableOpen, setExchangeTableOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [customCurrencyCode, setCustomCurrencyCode] = useState("");
  const [customCurrencyError, setCustomCurrencyError] = useState("");
  const [travelState, setTravelState] = useState<TravelState>(() => readStoredTravelState(normalizeCurrencyInput));
  const [travelHistory, setTravelHistory] = useState<TravelHistoryRecord[]>(() => readStoredTravelHistory(normalizeCurrencyInput));
  const [selectedTravelHistoryId, setSelectedTravelHistoryId] = useState<string | null>(null);
  const [travelHistoryRailOpen, setTravelHistoryRailOpen] = useState(false);
  const [travelHistoryMergeMode, setTravelHistoryMergeMode] = useState(false);
  const [travelHistorySelectedIds, setTravelHistorySelectedIds] = useState<string[]>([]);
  const [travelMergeModalOpen, setTravelMergeModalOpen] = useState(false);
  const [travelHistoryEditingId, setTravelHistoryEditingId] = useState<string | null>(null);
  const [travelHistoryEditingName, setTravelHistoryEditingName] = useState("");
  const [pendingTravelDeletes, setPendingTravelDeletes] = useState<PendingTravelHistoryDelete[]>(() =>
    readStoredPendingTravelDeletes(normalizeCurrencyInput),
  );
  const [deleteToastTick, setDeleteToastTick] = useState(0);
  const [travelDraftStartDate, setTravelDraftStartDate] = useState(getToday);
  const [travelDraftUseEndDate, setTravelDraftUseEndDate] = useState(false);
  const [travelDraftEndDate, setTravelDraftEndDate] = useState(getToday);
  const [travelDraftBillName, setTravelDraftBillName] = useState("");
  const [travelStatus, setTravelStatus] = useState("");
  const [backupReminderVisible, setBackupReminderVisible] = useState(() =>
    shouldShowBackupReminder(readBackupReminderState()),
  );
  const [trendMonths, setTrendMonths] = useState(6);
  const [trendCurrency, setTrendCurrency] = useState<Currency>("CNY");
  const [visibleRowCountsByDate, setVisibleRowCountsByDate] = useState<Record<string, number[]>>({});
  const [importMessage, setImportMessage] = useState("");
  const [naturalLedgerInput, setNaturalLedgerInput] = useState("");
  const [naturalLedgerPreview, setNaturalLedgerPreview] = useState<LocalLedgerRecord[]>([]);
  const [naturalLedgerWarnings, setNaturalLedgerWarnings] = useState<string[]>([]);
  const [naturalLedgerStatus, setNaturalLedgerStatus] = useState("");
  const [isParsingNaturalLedger, setIsParsingNaturalLedger] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState("");
  const [funCardShuffleSalt, setFunCardShuffleSalt] = useState(() => Math.floor(Math.random() * 100000));
  const userSelectedDateRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ledgerShellRef = useRef<HTMLDivElement | null>(null);
  const categoryRowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const [addButtonTops, setAddButtonTops] = useState<number[]>(() => CATEGORIES.map(() => 0));

  const selectedEntries = ledger[selectedDate] ?? makeDayEntries(dailyDefaultCurrency);
  const monthKey = getMonthKey(selectedDate);
  const weekRange = getWeekRange(selectedDate);
  const visibleRowCounts = visibleRowCountsByDate[selectedDate] ?? getDefaultRowCounts(selectedEntries);
  const weekTitle = `${formatMonthDay(weekRange.start)}-${formatMonthDay(weekRange.end)} 本周统计`;
  const allCurrencies = useMemo(
    () => Array.from(new Set([...DEFAULT_CURRENCIES, ...customCurrencies])),
    [customCurrencies],
  );
  const statVariant = Math.abs(parseDateKey(selectedDate).getDate()) % 3;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeLedger(ledger));
  }, [ledger]);

  useEffect(() => {
    localStorage.setItem(RATE_KEY, JSON.stringify(exchange));
  }, [exchange]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(customCurrencies));
  }, [customCurrencies]);

  useEffect(() => {
    localStorage.setItem(LAST_CURRENCY_KEY, lastCurrency);
  }, [lastCurrency]);

  useEffect(() => {
    localStorage.setItem(STATS_CURRENCIES_KEY, JSON.stringify(selectedStatsCurrencies));
  }, [selectedStatsCurrencies]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, themeMode);
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_KEY, JSON.stringify(travelState));
  }, [travelState]);

  useEffect(() => {
    setTravelDraftStartDate(selectedDate);
    if (!travelDraftUseEndDate) setTravelDraftEndDate(selectedDate);
  }, [selectedDate, travelDraftUseEndDate]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_HISTORY_KEY, JSON.stringify(travelHistory));
  }, [travelHistory]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_HISTORY_PENDING_DELETE_KEY, JSON.stringify(pendingTravelDeletes));
  }, [pendingTravelDeletes]);

  useEffect(() => {
    if (!pendingTravelDeletes.length) return;
    const timer = window.setInterval(() => {
      setPendingTravelDeletes((current) => purgeExpiredPendingDeletes(current));
      setDeleteToastTick((tick) => tick + 1);
    }, 500);
    return () => window.clearInterval(timer);
  }, [pendingTravelDeletes.length]);

  const animateModalClose = useCallback((close: () => void) => {
    const root = modalRootRef.current;
    if (!root || prefersReducedMotion()) {
      close();
      return;
    }

    const panel = root.querySelector<HTMLElement>(".modal-card");
    if (!panel) {
      close();
      return;
    }

    gsap.context(() => {
      gsap.timeline({
        onComplete: close,
        defaults: { ease: "power2.in", overwrite: "auto" },
      })
        .to(panel, { autoAlpha: 0, y: 14, scale: 0.96, duration: 0.24 })
        .to(root, { autoAlpha: 0, duration: 0.18 }, "-=0.1");
    }, root);
  }, []);

  const closeDatePicker = useCallback(
    () => animateModalClose(() => setDatePickerOpen(false)),
    [animateModalClose],
  );
  const closeCurrencyModal = useCallback(
    () => animateModalClose(() => setCurrencyModal(null)),
    [animateModalClose],
  );
  const closeExchangeTable = useCallback(
    () => animateModalClose(() => setExchangeTableOpen(false)),
    [animateModalClose],
  );
  const closeTravelHistoryModal = useCallback(
    () => animateModalClose(() => setSelectedTravelHistoryId(null)),
    [animateModalClose],
  );

  useEffect(() => {
    const stale = Date.now() - exchange.updatedAt > DAY_MS;
    if (stale) {
      setRateStatus("汇率缓存已超过 24 小时，可手动刷新；当前仍使用缓存/默认汇率。");
    }
  }, [exchange.updatedAt]);

  useEffect(() => {
    setExchange((current) => ({
      ...current,
      rates: normalizeRates(current.rates, allCurrencies),
    }));
  }, [allCurrencies]);

  useEffect(() => {
    const controller = new AbortController();
    const syncOnlineDate = async () => {
      try {
        const response = await fetch("https://worldtimeapi.org/api/ip", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("time service unavailable");
        const data = (await response.json()) as { datetime?: string };
        if (!data.datetime || userSelectedDateRef.current) return;
        setSelectedDate(formatDateKey(new Date(data.datetime)));
      } catch {
        // Local system date is the reliable browser-side fallback.
      }
    };

    syncOnlineDate();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedTravelHistoryId) closeTravelHistoryModal();
      else if (currencyModal) closeCurrencyModal();
      else if (exchangeTableOpen) closeExchangeTable();
      else if (datePickerOpen) closeDatePicker();
      else if (travelMergeModalOpen) setTravelMergeModalOpen(false);
      else if (travelHistoryRailOpen) setTravelHistoryRailOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    closeCurrencyModal,
    closeDatePicker,
    closeExchangeTable,
    closeTravelHistoryModal,
    currencyModal,
    datePickerOpen,
    exchangeTableOpen,
    selectedTravelHistoryId,
    travelHistoryRailOpen,
    travelMergeModalOpen,
  ]);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduceMotion) return;

      const intro = gsap.timeline({ defaults: { ease: "power3.out", overwrite: "auto" } });
      intro
        .fromTo(
          ".hero-copy-card",
          { autoAlpha: 0, y: 24, scale: 0.985 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.72, clearProps: "transform,opacity,visibility" },
        )
        .fromTo(
          ".hero-side-panel .date-card",
          { autoAlpha: 0, y: 16, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            stagger: 0.08,
            duration: 0.5,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.42",
        )
        .fromTo(
          ".natural-ledger-card, .ledger-card, .stats-card, .travel-card, .trend-card, .data-card",
          { autoAlpha: 0, y: 18, scale: 0.992 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            stagger: 0.055,
            duration: 0.55,
            clearProps: "transform,opacity,visibility",
          },
          "-=0.18",
        );

      gsap.to(".streak-glass", {
        y: -7,
        rotation: -0.45,
        duration: 3.2,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        overwrite: "auto",
      });

      gsap.to(".date-display-button strong", {
        y: -2,
        duration: 2.4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        overwrite: "auto",
      });
    }, root);

    const hoverTargets = root.querySelectorAll<HTMLElement>(
      ".daily-total, .totals-grid > div, .summary-list > div, .travel-details > div",
    );
    const enter = (event: Event) => {
      if (reduceMotion) return;
      const target = event.currentTarget as HTMLElement;
      gsap.to(target, { y: -4, scale: 1.008, duration: 0.28, ease: "power2.out", overwrite: "auto" });
    };
    const leave = (event: Event) => {
      if (reduceMotion) return;
      const target = event.currentTarget as HTMLElement;
      gsap.to(target, { y: 0, scale: 1, duration: 0.32, ease: "power2.out", overwrite: "auto" });
    };

    hoverTargets.forEach((target) => {
      target.addEventListener("mouseenter", enter);
      target.addEventListener("mouseleave", leave);
    });

    return () => {
      hoverTargets.forEach((target) => {
        target.removeEventListener("mouseenter", enter);
        target.removeEventListener("mouseleave", leave);
      });
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ".fun-data-card",
        { autoAlpha: 0, y: 18, scale: 0.94, rotation: -1.5 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotation: 0,
          duration: 0.52,
          ease: "back.out(1.7)",
          stagger: { each: 0.08, from: "random" },
          overwrite: "auto",
        },
      );
      gsap.to(".fun-card-orb", {
        x: () => gsap.utils.random(-7, 7),
        y: () => gsap.utils.random(-6, 6),
        scale: () => gsap.utils.random(0.92, 1.08),
        duration: () => gsap.utils.random(2.4, 3.8),
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.12,
        overwrite: "auto",
      });
    }, root);

    return () => ctx.revert();
  }, [selectedDate, funCardShuffleSalt]);

  useEffect(() => {
    const root = modalRootRef.current;
    if (!root) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      const panel = root.querySelector<HTMLElement>(".modal-card");
      const revealItems = root.querySelectorAll<HTMLElement>(
        ".modal-heading, .date-modal-panel, .currency-card-option, .rate-table > div, .custom-currency-box, .rate-modal > .muted, .travel-history-modal-details > *, .travel-merge-form, .travel-merge-preview, .travel-merge-confirm, .travel-merge-actions",
      );

      if (reduceMotion) {
        gsap.set([root, panel, ...Array.from(revealItems)].filter(Boolean), {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          clearProps: "transform,opacity,visibility",
        });
        return;
      }

      const timeline = gsap.timeline({ defaults: { ease: "power3.out", overwrite: "auto" } });
      timeline
        .fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, clearProps: "opacity,visibility" })
        .fromTo(
          panel,
          { autoAlpha: 0, y: 18, scale: 0.965 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, clearProps: "transform,opacity,visibility" },
          "<0.02",
        )
        .fromTo(
          revealItems,
          { autoAlpha: 0, y: 10 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.26,
            stagger: { each: 0.035, from: "start" },
            clearProps: "transform,opacity,visibility",
          },
          "-=0.18",
        );
    }, root);

    return () => ctx.revert();
  }, [datePickerOpen, currencyModal, exchangeTableOpen, selectedTravelHistoryId, travelMergeModalOpen]);

  useEffect(() => {
    const preview = naturalPreviewRef.current;
    if (!preview || !naturalLedgerPreview.length) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      const rows = preview.querySelectorAll<HTMLElement>("tbody tr");
      if (reduceMotion) {
        gsap.set([preview, ...Array.from(rows)], {
          autoAlpha: 1,
          y: 0,
          clearProps: "transform,opacity,visibility",
        });
        return;
      }

      gsap.fromTo(
        preview,
        { autoAlpha: 0, y: 16, scale: 0.99 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          ease: "power3.out",
          overwrite: "auto",
          clearProps: "transform,opacity,visibility",
        },
      );
      gsap.fromTo(
        rows,
        { autoAlpha: 0, y: 8 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.24,
          ease: "power2.out",
          stagger: 0.025,
          overwrite: "auto",
          clearProps: "transform,opacity,visibility",
        },
      );
    }, preview);

    return () => ctx.revert();
  }, [naturalLedgerPreview.length]);

  const syncAddButtonPositions = useCallback(() => {
    const shell = ledgerShellRef.current;
    if (!shell) return;

    const shellTop = shell.getBoundingClientRect().top;
    const tbodyBottom =
      shell.querySelector("tbody")?.getBoundingClientRect().bottom ??
      shell.querySelector(".ledger-table-wrap")?.getBoundingClientRect().bottom ??
      shell.getBoundingClientRect().bottom;
    setAddButtonTops(
      CATEGORIES.map((_, categoryIndex) => {
        const row = categoryRowRefs.current[categoryIndex];
        if (!row) return 0;
        const rowTop = row.getBoundingClientRect().top;
        const nextRow = categoryRowRefs.current[categoryIndex + 1];
        const rowBottom = nextRow?.getBoundingClientRect().top ?? tbodyBottom;
        return rowTop - shellTop + (rowBottom - rowTop) / 2 - 16;
      }),
    );
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(syncAddButtonPositions);
    return () => cancelAnimationFrame(frame);
  }, [selectedDate, visibleRowCounts, syncAddButtonPositions]);

  useEffect(() => {
    const shell = ledgerShellRef.current;
    if (!shell) return;

    syncAddButtonPositions();
    const observer = new ResizeObserver(() => syncAddButtonPositions());
    observer.observe(shell);

    const tableWrap = shell.querySelector(".ledger-table-wrap");
    if (tableWrap) observer.observe(tableWrap);

    window.addEventListener("resize", syncAddButtonPositions);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncAddButtonPositions);
    };
  }, [syncAddButtonPositions, selectedDate, visibleRowCounts]);

  const commitDateChange = (date: string) => {
    userSelectedDateRef.current = true;
    setSelectedDate(date);
    setDailyDefaultCurrency("HKD");
  };

  const moveSelectedDate = (offset: number) => {
    commitDateChange(shiftDateKey(selectedDate, offset));
  };

  const jumpToToday = () => {
    commitDateChange(getToday());
  };

  const updateEntry = (index: number, patch: Partial<LedgerEntry>) => {
    setLedger((current) => {
      const entries = current[selectedDate] ? [...current[selectedDate]] : makeDayEntries(dailyDefaultCurrency);
      entries[index] = sanitizeEntry({ ...entries[index], ...patch }, dailyDefaultCurrency);
      return { ...current, [selectedDate]: entries };
    });
    if (patch.currency) setLastCurrency(patch.currency);
  };

  const displayStatsCurrencies = selectedStatsCurrencies.filter((currency) => allCurrencies.includes(currency));
  const safeDisplayStatsCurrencies = displayStatsCurrencies.length ? displayStatsCurrencies : [dailyDefaultCurrency];

  const dayTotals = useMemo(() => getEntryTotals(selectedEntries, exchange, allCurrencies), [selectedEntries, exchange, allCurrencies]);

  const categoryTotals = useMemo(
    () =>
      CATEGORIES.map((category, categoryIndex) => {
        const entries = getCategoryEntries(selectedEntries, categoryIndex);
        return { category, ...getEntryTotals(entries, exchange, allCurrencies) };
      }),
    [selectedEntries, exchange, allCurrencies],
  );

  const weekEntries = useMemo(
    () => collectEntries(ledger, (date) => isInRange(date, weekRange.start, weekRange.end)),
    [ledger, weekRange.start, weekRange.end],
  );

  const monthEntries = useMemo(
    () => collectEntries(ledger, (date) => getMonthKey(date) === monthKey),
    [ledger, monthKey],
  );

  const weekTotals = useMemo(() => getEntryTotals(weekEntries, exchange, allCurrencies), [weekEntries, exchange, allCurrencies]);
  const monthTotals = useMemo(() => getEntryTotals(monthEntries, exchange, allCurrencies), [monthEntries, exchange, allCurrencies]);
  const weekCategorySummary = useMemo(
    () => summarizeByCategory(weekEntries, exchange, dailyDefaultCurrency),
    [weekEntries, exchange, dailyDefaultCurrency],
  );
  const monthCategorySummary = useMemo(
    () => summarizeByCategory(monthEntries, exchange, dailyDefaultCurrency),
    [monthEntries, exchange, dailyDefaultCurrency],
  );

  const exchangeRows = useMemo(
    () =>
      allCurrencies.filter((currency) => currency !== dailyDefaultCurrency).map((currency) => ({
        currency,
        value: convert(1, dailyDefaultCurrency, currency, exchange),
      })),
    [allCurrencies, dailyDefaultCurrency, exchange],
  );

  const refreshExchange = async () => {
    setRateStatus("正在刷新汇率...");
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!response.ok) throw new Error("汇率服务无响应");
      const data = (await response.json()) as { rates?: Partial<Record<ApiCurrency, number>>; result?: string };
      if (data.result && data.result !== "success") throw new Error("汇率服务返回失败");
      const rates = normalizeRates(data.rates, allCurrencies);
      const hasRequiredRates = allCurrencies.map(getApiCode).every((code) => Number.isFinite(rates[code]) && rates[code] > 0);
      if (!hasRequiredRates) throw new Error("汇率数据格式异常");
      setExchange({
        base: "USD",
        rates,
        updatedAt: Date.now(),
        source: "open.er-api.com",
      });
      setRateStatus(`汇率已刷新并缓存 24 小时。当前基准：1 ${dailyDefaultCurrency}`);
    } catch (error) {
      setRateStatus(
        `刷新失败，继续使用 ${exchange.source} 汇率表。${error instanceof Error ? error.message : ""}`,
      );
    }
  };

  const handleAmountChange = (index: number, value: string) => {
    if (/^-?\d*\.?\d{0,2}$/.test(value) || value === "-" || value === "") {
      updateEntry(index, { amount: value });
    }
  };

  const validateNewCurrency = (value: string) => {
    const code = normalizeCurrencyCode(value);
    if (!/^[A-Z]{3}$/.test(code)) return { code, error: "请输入 3 位大写英文字母货币代号，例如 CAD。" };
    const normalized = code === "TWD" ? "NTD" : code;
    if (!COMMON_ISO_4217_CODES.has(code) && !COMMON_ISO_4217_CODES.has(normalized)) {
      return { code: normalized, error: "未识别该 ISO 4217 货币代号，请检查后重试。" };
    }
    if (allCurrencies.includes(normalized)) return { code: normalized, error: "该货币已经在列表中。" };
    return { code: normalized, error: "" };
  };

  const addCustomCurrency = async () => {
    const result = validateNewCurrency(customCurrencyCode);
    if (result.error) {
      setCustomCurrencyError(result.error);
      return;
    }
    const code = result.code;
    const apiCode = getApiCode(code);
    setCustomCurrencies((current) => current.includes(code) ? current : [...current, code]);
    localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(Array.from(new Set([...customCurrencies, code]))));
    setSelectedStatsCurrencies((current) => current.includes(code) ? current : [...current, code]);
    setCustomCurrencyCode("");
    setCustomCurrencyError("");
    setRateStatus(`已添加 ${code}，正在检查实时汇率...`);
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!response.ok) throw new Error("汇率服务无响应");
      const data = (await response.json()) as { rates?: Partial<Record<ApiCurrency, number>>; result?: string };
      const rate = data.rates?.[apiCode];
      if (data.result && data.result !== "success") throw new Error("汇率服务返回失败");
      if (!Number.isFinite(rate) || !rate || rate <= 0) throw new Error("该货币暂未返回实时汇率");
      setExchange((current) => ({
        base: "USD",
        rates: normalizeRates({ ...current.rates, ...data.rates, [apiCode]: rate }, [...allCurrencies, code]),
        updatedAt: Date.now(),
        source: "open.er-api.com",
      }));
      setRateStatus(`已添加 ${code} 并同步实时汇率。`);
    } catch (error) {
      setExchange((current) => ({
        ...current,
        rates: normalizeRates({ ...current.rates, [apiCode]: current.rates[apiCode] ?? DEFAULT_USD_RATES[apiCode] ?? 1 }, [...allCurrencies, code]),
      }));
      setRateStatus(`已添加 ${code}；${error instanceof Error ? error.message : "汇率暂不可用"}，暂用 1:1 回退避免统计中断。`);
    }
  };

  const toggleEntryHidden = (index: number) => {
    const entry = selectedEntries[index] ?? makeBlankEntry(dailyDefaultCurrency);
    updateEntry(index, { hidden: !entry.hidden });
  };

  const switchDailyDefaultCurrency = (currency: Currency) => {
    const previousCurrency = dailyDefaultCurrency;
    setDailyDefaultCurrency(currency);
    setSelectedStatsCurrencies((current) => {
      if (current.length === 1 && current[0] === previousCurrency) return [currency];
      return current.includes(currency) ? current : [currency, ...current];
    });
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

  const handleCurrencySelect = (currency: Currency) => {
    if (!currencyModal) return;
    if (currencyModal.type === "daily-default") {
      switchDailyDefaultCurrency(currency);
    } else {
      updateEntry(currencyModal.index, { currency });
      focusCell(selectedDate, currencyModal.index, "note");
    }
    closeCurrencyModal();
  };

  const toggleStatsCurrency = (currency: Currency) => {
    setSelectedStatsCurrencies((current) => {
      if (current.includes(currency)) {
        const next = current.filter((item) => item !== currency);
        return next.length ? next : [dailyDefaultCurrency];
      }
      return [...current, currency];
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
    if (nextRowIndex >= MAX_RECORDS_PER_CATEGORY) {
      setShortcutFeedback(`「${CATEGORIES[categoryIndex]}」已达 ${MAX_RECORDS_PER_CATEGORY} 条上限。`);
      return;
    }
    setShortcutFeedback("");
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
    setLedger((current) => {
      const entries = current[selectedDate] ? [...current[selectedDate]] : makeDayEntries(dailyDefaultCurrency);
      if (currentRowCount <= 1) {
        entries[getEntryIndex(categoryIndex, rowIndex)] = makeBlankEntry(dailyDefaultCurrency);
        return { ...current, [selectedDate]: entries };
      }
      const categoryEntries = getCategoryEntries(entries, categoryIndex);
      const nextCategoryEntries = categoryEntries.filter((_, index) => index !== rowIndex);
      nextCategoryEntries.push(makeBlankEntry(dailyDefaultCurrency));
      nextCategoryEntries.slice(0, MAX_RECORDS_PER_CATEGORY).forEach((entry, index) => {
        entries[getEntryIndex(categoryIndex, index)] = entry;
      });
      return { ...current, [selectedDate]: entries };
    });
    if (currentRowCount <= 1) {
      focusCell(selectedDate, getEntryIndex(categoryIndex, rowIndex));
      return;
    }
    updateVisibleRowCount(categoryIndex, currentRowCount - 1);
    focusCell(selectedDate, getEntryIndex(categoryIndex, Math.max(0, rowIndex - 1)));
  };

  const focusCell = (date: string, index: number, field: keyof LedgerEntry = "amount") => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-date="${date}"][data-index="${index}"][data-field="${field}"]`)?.focus();
    });
  };

  const getVisibleIndex = (categoryIndex: number, rowIndex: number) =>
    getEntryIndex(categoryIndex, Math.min(rowIndex, visibleRowCounts[categoryIndex] - 1));

  const focusNextCategoryAmount = (categoryIndex: number) => {
    const nextCategoryIndex = (categoryIndex + 1) % CATEGORIES.length;
    focusCell(selectedDate, getVisibleIndex(nextCategoryIndex, 0), "amount");
  };

  const moveEditableFocus = (
    categoryIndex: number,
    rowIndex: number,
    field: EditableField,
    direction: "up" | "down" | "left" | "right",
  ) => {
    if (direction === "left" || direction === "right") {
      const fieldIndex = EDITABLE_FIELDS.indexOf(field);
      const nextFieldIndex = fieldIndex + (direction === "left" ? -1 : 1);
      if (nextFieldIndex < 0 || nextFieldIndex >= EDITABLE_FIELDS.length) return;
      focusCell(selectedDate, getEntryIndex(categoryIndex, rowIndex), EDITABLE_FIELDS[nextFieldIndex]);
      return;
    }

    const nextRowIndex = rowIndex + (direction === "up" ? -1 : 1);
    if (nextRowIndex >= 0 && nextRowIndex < visibleRowCounts[categoryIndex]) {
      focusCell(selectedDate, getEntryIndex(categoryIndex, nextRowIndex), field);
      return;
    }

    const nextCategoryIndex =
      direction === "up"
        ? (categoryIndex - 1 + CATEGORIES.length) % CATEGORIES.length
        : (categoryIndex + 1) % CATEGORIES.length;
    const targetRowIndex = direction === "up" ? visibleRowCounts[nextCategoryIndex] - 1 : 0;
    focusCell(selectedDate, getVisibleIndex(nextCategoryIndex, targetRowIndex), field);
  };

  const shouldPreserveInlineArrow = (
    event: KeyboardEvent<HTMLInputElement>,
    field: EditableField,
    direction: "left" | "right",
  ) => {
    if (field === "amount") return false;
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    if (start !== end) return true;
    return direction === "left" ? start > 0 : end < input.value.length;
  };

  const handleInputKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    categoryIndex: number,
    rowIndex: number,
    field: EditableField,
  ) => {
    const entryIndex = getEntryIndex(categoryIndex, rowIndex);

    if (field === "amount" && event.key === "Enter") {
      event.preventDefault();
      addCategoryRecord(categoryIndex);
      return;
    }

    if (field === "amount" && event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      setShortcutFeedback("");
      focusNextCategoryAmount(categoryIndex);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setShortcutFeedback("");
      moveEditableFocus(categoryIndex, rowIndex, field, event.key === "ArrowUp" ? "up" : "down");
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const direction = event.key === "ArrowLeft" ? "left" : "right";
      if (shouldPreserveInlineArrow(event, field, direction)) return;
      event.preventDefault();
      setShortcutFeedback("");
      moveEditableFocus(categoryIndex, rowIndex, field, direction);
      return;
    }

    if (entryIndex >= 0) setShortcutFeedback("");
  };

  const exportCsv = () => {
    const rows = [["date", "category", "slot", "amount", "currency", "note", "hidden"]];
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
            entry.hidden ? "true" : "false",
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
      if (char === '"' && quoted && line[index + 1] === '"') {
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
    const importedCustomCurrencies = new Set<Currency>();
    let imported = 0;
    for (const line of lines.slice(1)) {
      const [date, category, slot, amount, currency, note, hidden] = parseCsvLine(line);
      const categoryIndex = CATEGORIES.indexOf(category);
      const rowIndex = Number(slot) - 1;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || categoryIndex < 0 || rowIndex < 0 || rowIndex >= MAX_RECORDS_PER_CATEGORY) continue;
      const normalizedCurrency = normalizeCurrencyInput(currency) ?? (() => {
        const code = normalizeCurrencyCode(currency);
        const normalized = code === "TWD" ? "NTD" : code;
        return /^[A-Z]{3}$/.test(code) && (COMMON_ISO_4217_CODES.has(code) || COMMON_ISO_4217_CODES.has(normalized))
          ? normalized
          : null;
      })();
      if (!normalizedCurrency) continue;
      if (!allCurrencies.includes(normalizedCurrency)) importedCustomCurrencies.add(normalizedCurrency);
      const entryIndex = getEntryIndex(categoryIndex, rowIndex);
      const entries = nextLedger[date] ? [...nextLedger[date]] : makeDayEntries(normalizedCurrency);
      entries[entryIndex] = sanitizeEntry(
        { amount, currency: normalizedCurrency, note, hidden: hidden?.toLowerCase() === "true" },
        normalizedCurrency,
      );
      nextLedger[date] = entries;
      imported += 1;
    }
    if (importedCustomCurrencies.size) {
      setCustomCurrencies((current) => Array.from(new Set([...current, ...importedCustomCurrencies])));
      localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(Array.from(new Set([...customCurrencies, ...importedCustomCurrencies]))));
      setExchange((current) => ({
        ...current,
        rates: normalizeRates(current.rates, [...allCurrencies, ...importedCustomCurrencies]),
      }));
    }
    setLedger(nextLedger);
    setImportMessage(`已导入 ${imported} 条记录。`);
    event.target.value = "";
  };

  const getPreviewRecordIssues = useCallback(
    (record: LocalLedgerRecord) => {
      const issues: string[] = [];
      const amount = record.amount.trim();
      if (!isValidDateKey(record.date.trim())) issues.push("日期格式无效");
      if (!CATEGORIES.includes(record.category)) issues.push("分类不在列表内");
      if (!/^-?\d+(?:\.\d{1,2})?$/.test(amount) || parseAmount(amount) === 0) issues.push("金额需为非 0 有限数字");
      if (!allCurrencies.includes(record.currency)) issues.push("货币不在列表内");
      return issues;
    },
    [allCurrencies],
  );

  const normalizeParsedNaturalRecord = (record: LocalLedgerRecord) => {
    const amount = record.amount.trim();
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(amount) || parseAmount(amount) === 0) return null;
    const normalized: LocalLedgerRecord = {
      date: isValidDateKey(record.date.trim()) ? record.date.trim() : selectedDate,
      category: CATEGORIES.includes(record.category) ? record.category : "其他",
      amount,
      currency: allCurrencies.includes(record.currency) ? record.currency : dailyDefaultCurrency,
      note: record.note.replace(/["'“”‘’`]/g, "").trim(),
    };
    if (record.hidden === true) normalized.hidden = true;
    return normalized;
  };

  const naturalLedgerPreviewIssues = useMemo(
    () => naturalLedgerPreview.map(getPreviewRecordIssues),
    [getPreviewRecordIssues, naturalLedgerPreview],
  );

  const canImportNaturalLedgerPreview =
    naturalLedgerPreview.length > 0 && naturalLedgerPreviewIssues.every((issues) => issues.length === 0);

  const updateNaturalLedgerPreviewRecord = (index: number, field: PreviewField, value: string) => {
    setNaturalLedgerPreview((current) =>
      current.map((record, recordIndex) =>
        recordIndex === index ? { ...record, [field]: value } : record,
      ),
    );
    setNaturalLedgerWarnings([]);
  };

  const deleteNaturalLedgerPreviewRecord = (index: number) => {
    setNaturalLedgerPreview((current) => current.filter((_, recordIndex) => recordIndex !== index));
    setNaturalLedgerWarnings([]);
    setNaturalLedgerStatus((current) => current || "已删除一条待导入记录。");
  };

  const addNaturalLedgerPreviewRecord = () => {
    setNaturalLedgerPreview((current) => [
      ...current,
      {
        date: selectedDate,
        category: "其他",
        amount: "",
        currency: dailyDefaultCurrency,
        note: "",
      },
    ]);
    setNaturalLedgerWarnings([]);
    setNaturalLedgerStatus("已新增一条空白待导入记录，请补全金额和备注。");
  };

  const importNaturalLedgerRecords = (records: LocalLedgerRecord[]) => {
    const nextLedger = { ...ledger };
    const nextVisibleRowCounts = { ...visibleRowCountsByDate };
    const importedCustomCurrencies = new Set<Currency>();
    const messages: string[] = [];
    let imported = 0;

    for (const record of records) {
      const date = record.date.trim();
      const categoryIndex = CATEGORIES.indexOf(record.category);
      const normalizedCurrency = normalizeCurrencyInput(record.currency) ?? (() => {
        const code = normalizeCurrencyCode(record.currency);
        const normalized = code === "TWD" ? "NTD" : code;
        return /^[A-Z]{3}$/.test(code) && (COMMON_ISO_4217_CODES.has(code) || COMMON_ISO_4217_CODES.has(normalized))
          ? normalized
          : null;
      })();
      const amount = record.amount.trim();

      if (!isValidDateKey(date)) {
        messages.push(`已跳过日期无效的记录：${record.note || record.amount}`);
        continue;
      }
      if (categoryIndex < 0) {
        messages.push(`已跳过类目无效的记录：${record.category || record.note}`);
        continue;
      }
      if (!/^-?\d+(?:\.\d{1,2})?$/.test(amount) || parseAmount(amount) === 0) {
        messages.push(`已跳过金额无效的记录：${record.note || amount}`);
        continue;
      }
      if (!normalizedCurrency) {
        messages.push(`已跳过货币无效的记录：${record.currency || record.note}`);
        continue;
      }
      if (!allCurrencies.includes(normalizedCurrency)) importedCustomCurrencies.add(normalizedCurrency);

      const entries = nextLedger[date] ? [...nextLedger[date]] : makeDayEntries(normalizedCurrency);
      const categoryEntries = getCategoryEntries(entries, categoryIndex);
      const rowIndex = categoryEntries.findIndex((entry) => !hasEntryContent(entry));
      if (rowIndex < 0 || rowIndex >= MAX_RECORDS_PER_CATEGORY) {
        messages.push(`${date}「${record.category}」已达 ${MAX_RECORDS_PER_CATEGORY} 条上限，已跳过：${record.note || amount}`);
        continue;
      }

      entries[getEntryIndex(categoryIndex, rowIndex)] = sanitizeEntry(
        {
          amount,
          currency: normalizedCurrency,
          note: record.note.trim(),
          hidden: record.hidden === true,
        },
        normalizedCurrency,
      );
      nextLedger[date] = entries;

      const counts = [...(nextVisibleRowCounts[date] ?? getDefaultRowCounts(entries))];
      counts[categoryIndex] = Math.max(counts[categoryIndex] ?? 1, rowIndex + 1);
      nextVisibleRowCounts[date] = counts;
      imported += 1;
    }

    if (importedCustomCurrencies.size) {
      setCustomCurrencies((current) => Array.from(new Set([...current, ...importedCustomCurrencies])));
      localStorage.setItem(CUSTOM_CURRENCIES_KEY, JSON.stringify(Array.from(new Set([...customCurrencies, ...importedCustomCurrencies]))));
      setExchange((current) => ({
        ...current,
        rates: normalizeRates(current.rates, [...allCurrencies, ...importedCustomCurrencies]),
      }));
    }
    if (imported) {
      setLedger(nextLedger);
      setVisibleRowCountsByDate(nextVisibleRowCounts);
    }
    return { imported, messages };
  };

  const parseNaturalLedgerInput = async () => {
    setIsParsingNaturalLedger(true);
    setNaturalLedgerStatus("正在使用本地规则整理自然语言账单...");
    setNaturalLedgerWarnings([]);
    try {
      const result = await parseNaturalLedger(naturalLedgerInput, {
        selectedDate,
        defaultCurrency: dailyDefaultCurrency,
        categories: CATEGORIES,
        currencies: allCurrencies,
      });
      const frontendWarnings = [...result.warnings];
      const records = result.records
        .map((record) => {
          const normalized = normalizeParsedNaturalRecord(record);
          if (!normalized) frontendWarnings.push(`已跳过金额无效的记录：${record.note || record.amount}`);
          return normalized;
        })
        .filter((record): record is LocalLedgerRecord => Boolean(record));
      setNaturalLedgerPreview(records);
      setNaturalLedgerWarnings(frontendWarnings);
      setNaturalLedgerStatus(
        records.length
          ? `已通过本地规则解析整理出 ${records.length} 条待导入记录，可逐条编辑后确认导入。`
          : "未整理出可导入记录，请补充金额、货币或备注后重试。",
      );
    } catch (error) {
      setNaturalLedgerPreview([]);
      setNaturalLedgerStatus(`整理失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsParsingNaturalLedger(false);
    }
  };

  const clearNaturalLedgerInput = () => {
    setNaturalLedgerInput("");
    setNaturalLedgerPreview([]);
    setNaturalLedgerWarnings([]);
    setNaturalLedgerStatus("");
  };

  const confirmNaturalLedgerImport = () => {
    if (!naturalLedgerPreview.length) {
      setNaturalLedgerStatus("没有待导入记录。");
      return;
    }
    if (!canImportNaturalLedgerPreview) {
      const messages = naturalLedgerPreviewIssues.flatMap((issues, index) =>
        issues.map((issue) => `第 ${index + 1} 条：${issue}`),
      );
      setNaturalLedgerWarnings(messages);
      setNaturalLedgerStatus("请先修正待导入记录中的校验提示。");
      return;
    }
    const { imported, messages } = importNaturalLedgerRecords(naturalLedgerPreview);
    setNaturalLedgerWarnings(messages);
    setNaturalLedgerStatus(
      imported
        ? `已确认导入 ${imported} 条记录${messages.length ? `，另有 ${messages.length} 条提示。` : "。"}`
        : messages.length ? "没有记录被导入，请查看提示。" : "没有待导入记录。",
    );
    if (imported) {
      setImportMessage(`自然语言记账已导入 ${imported} 条记录。`);
      setNaturalLedgerPreview([]);
    }
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
    totals: EntryTotals,
    summary: CategorySummary,
    type: "week" | "month",
    variant: number,
  ) => {
    return (
      <section className={`card stats-card stat-variant-${variant}`}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">{range}</p>
            <h2>{title}</h2>
          </div>
          <button
            className="ghost-button"
            onClick={() => setExpandedStats((current) => ({ ...current, [type]: !current[type] }))}
          >
            {expandedStats[type] ? "收起" : "展开"}
          </button>
        </div>
        <div className="currency-filter" aria-label={`${title}统计货币口径`}>
          <span>统计口径</span>
          <div>
            {allCurrencies.map((currency) => (
              <button
                key={currency}
                type="button"
                className={safeDisplayStatsCurrencies.includes(currency) ? "currency-chip active" : "currency-chip"}
                onClick={() => toggleStatsCurrency(currency)}
                aria-pressed={safeDisplayStatsCurrencies.includes(currency)}
              >
                {currency}
              </button>
            ))}
          </div>
        </div>
        <div className="totals-grid">
          {safeDisplayStatsCurrencies.map((currency) => (
            <div key={currency}>
              <span>{currency === dailyDefaultCurrency ? "当前默认口径" : `${getCurrencyMeta(currency).shortName}口径`}</span>
              <strong>{formatMoney(totals.converted[currency], currency)}</strong>
            </div>
          ))}
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
        <StatsExpandPanel open={expandedStats[type]}>
          {summary.map((item) => (
            <div key={item.category}>
              <span>{item.category}</span>
              <span>{formatMoney(item.value, dailyDefaultCurrency)} · {item.percent.toFixed(1)}%</span>
            </div>
          ))}
          {type === "month" && (
            <div className="monthly-summary-panel">
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
                  <select
                    value={baseCurrency}
                    onChange={(event) => {
                      if (allCurrencies.includes(event.target.value)) setBaseCurrency(event.target.value);
                    }}
                  >
                    {allCurrencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency} · {getCurrencyMeta(currency).shortName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="summary-list">
                {monthlySummaryRows.length ? (
                  monthlySummaryRows.map(({ category, totals: rowTotals }) => (
                    <div key={category}>
                      <span>{category}</span>
                      {summaryMode === "split" ? (
                        <strong>
                          {allCurrencies.filter((currency) => (rowTotals.native[currency] ?? 0) !== 0)
                            .map((currency) => formatMoney(rowTotals.native[currency], currency))
                            .join(" / ")}
                        </strong>
                      ) : (
                        <strong>{formatMoney(rowTotals.converted[baseCurrency], baseCurrency)}</strong>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="muted">本月还没有可汇总的支出。</p>
                )}
              </div>
            </div>
          )}
        </StatsExpandPanel>
      </section>
    );
  };

  const monthlySummaryRows = CATEGORIES.map((category) => {
    const entries = monthEntries.filter((entry) => entry.category === category);
    const totals = getEntryTotals(entries, exchange, allCurrencies);
    return { category, totals };
  }).filter((row) => hasTotals(row.totals, allCurrencies));

  const streakDays = useMemo(() => {
    let count = 0;
    let cursor = selectedDate;
    while (true) {
      const entries = ledger[cursor];
      const hasValidEntry = entries?.some((entry) => !entry.hidden && parseAmount(entry.amount) !== 0) ?? false;
      if (!hasValidEntry) break;
      count += 1;
      cursor = shiftDateKey(cursor, -1);
    }
    return count;
  }, [ledger, selectedDate]);

  const travelEndDate = travelState.active
    ? selectedDate
    : travelState.endDate ?? travelState.plannedEndDate ?? selectedDate;
  const travelRangeLabel = travelState.startDate
    ? travelState.active
      ? travelState.plannedEndDate
        ? `${travelState.startDate} 至 ${travelState.plannedEndDate}（进行中，当前 ${selectedDate}）`
        : `${travelState.startDate} 起 · 未设结束（当前 ${selectedDate}）`
      : `${travelState.startDate} 至 ${travelEndDate}`
    : "开启后可设定账单名称与日期范围，期间可使用目的地默认货币。";
  const travelEntries = useMemo(
    () =>
      travelState.startDate
        ? collectEntries(ledger, (date) => isInRange(date, travelState.startDate ?? selectedDate, travelEndDate))
        : [],
    [ledger, selectedDate, travelEndDate, travelState.startDate],
  );
  const travelTotals = useMemo(
    () => getEntryTotals(travelEntries, exchange, allCurrencies),
    [travelEntries, exchange, allCurrencies],
  );
  const travelCategorySummary = useMemo(
    () => summarizeByCategory(travelEntries, exchange, travelState.targetCurrency),
    [travelEntries, exchange, travelState.targetCurrency],
  );
  const travelDetails = useMemo(
    () =>
      travelEntries
        .filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [travelEntries],
  );

  const selectedTravelHistory = useMemo(
    () => travelHistory.find((item) => item.id === selectedTravelHistoryId) ?? null,
    [travelHistory, selectedTravelHistoryId],
  );

  const dismissBackupReminder = (permanent = false) => {
    const nextState: BackupReminderState = { dismissedAt: Date.now(), permanent };
    localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(nextState));
    setBackupReminderVisible(false);
  };

  const enableTravelMode = () => {
    const startDate = isValidDateKey(travelDraftStartDate) ? travelDraftStartDate : selectedDate;
    const plannedEndDate =
      travelDraftUseEndDate && isValidDateKey(travelDraftEndDate) && travelDraftEndDate >= startDate
        ? travelDraftEndDate
        : null;
    const destinationCurrency = travelState.destinationCurrency || dailyDefaultCurrency;
    const billName =
      travelDraftBillName.trim() ||
      buildBillNameFromLocation(null, destinationCurrency);

    setTravelState({
      active: true,
      startDate,
      endDate: null,
      plannedEndDate,
      destinationCurrency,
      targetCurrency: travelState.targetCurrency || dailyDefaultCurrency,
      billName,
      locationLabel: null,
    });
    switchDailyDefaultCurrency(destinationCurrency);
    setTravelStatus("旅游模式已开启，正在后台尝试自动识别所在地…");

    void detectTravelGeo(normalizeCurrencyInput)
      .then((geo) => {
        if (!allCurrencies.includes(geo.destinationCurrency)) {
          setCustomCurrencies((current) =>
            current.includes(geo.destinationCurrency) ? current : [...current, geo.destinationCurrency],
          );
        }
        setExchange((current) => ({
          ...current,
          rates: normalizeRates(current.rates, [...allCurrencies, geo.destinationCurrency]),
        }));
        setTravelState((current) => {
          if (!current.active) return current;
          return {
            ...current,
            destinationCurrency: geo.destinationCurrency,
            locationLabel: geo.locationLabel,
            billName: travelDraftBillName.trim() || geo.billName,
          };
        });
        switchDailyDefaultCurrency(geo.destinationCurrency);
        if (!travelDraftBillName.trim()) {
          setTravelDraftBillName(geo.billName);
        }
        setTravelStatus(`已识别 ${geo.locationLabel || geo.countryName || "当前位置"} · ${geo.destinationCurrency}。`);
      })
      .catch((error) => {
        setTravelStatus(
          `旅游模式已开启；自动定位失败，沿用手动设置。${error instanceof Error ? error.message : ""}`,
        );
      });
  };

  const endTravelMode = () => {
    const startDate = travelState.startDate ?? travelDraftStartDate ?? selectedDate;
    const endDate = selectedDate;
    const totalAmount = travelTotals.converted[travelState.targetCurrency] ?? 0;
    const billName =
      travelState.billName?.trim() ||
      buildBillNameFromLocation(travelState.locationLabel, travelState.destinationCurrency);

    if (travelDetails.length > 0 || totalAmount !== 0) {
      const record: TravelHistoryRecord = {
        id: `travel-${Date.now()}`,
        name: billName,
        startDate,
        endDate,
        destinationCurrency: travelState.destinationCurrency,
        targetCurrency: travelState.targetCurrency,
        totalAmount,
        entryCount: travelDetails.length,
        categorySummary: travelCategorySummary.map(({ category, value, percent }) => ({
          category,
          value,
          percent,
        })),
        details: travelDetails.map((entry) => ({
          date: entry.date,
          category: entry.category,
          amount: entry.amount,
          currency: entry.currency,
          note: entry.note,
          convertedAmount: convert(
            parseAmount(entry.amount),
            entry.currency,
            travelState.targetCurrency,
            exchange,
          ),
        })),
        savedAt: Date.now(),
      };
      setTravelHistory((current) => [record, ...current]);
    }

    setTravelState({ ...DEFAULT_TRAVEL_STATE });
    setTravelDraftBillName("");
    setTravelDraftUseEndDate(false);
    setTravelStatus(`旅游模式已结束，账单「${billName}」已写入历史：${startDate} 至 ${endDate}。`);
  };

  const saveTravelHistoryRename = () => {
    if (!travelHistoryEditingId || !travelHistoryEditingName.trim()) return;
    setTravelHistory((current) =>
      current.map((record) =>
        record.id === travelHistoryEditingId ? { ...record, name: travelHistoryEditingName.trim() } : record,
      ),
    );
    setTravelHistoryEditingId(null);
    setTravelHistoryEditingName("");
  };

  const deleteTravelHistoryRecord = (id: string) => {
    const record = travelHistory.find((item) => item.id === id);
    if (!record) return;
    setTravelHistory((current) => current.filter((item) => item.id !== id));
    setPendingTravelDeletes((current) => [
      ...current.filter((item) => item.record.id !== id),
      { record, deletedAt: Date.now() },
    ]);
    if (selectedTravelHistoryId === id) setSelectedTravelHistoryId(null);
    if (travelHistoryEditingId === id) {
      setTravelHistoryEditingId(null);
      setTravelHistoryEditingName("");
    }
    setTravelHistorySelectedIds((current) => current.filter((item) => item !== id));
    setDeleteToastTick((tick) => tick + 1);
  };

  const undoTravelHistoryDelete = (id: string) => {
    const pending = pendingTravelDeletes.find((item) => item.record.id === id);
    if (!pending) return;
    setTravelHistory((current) =>
      [pending.record, ...current].sort((a, b) => b.savedAt - a.savedAt),
    );
    setPendingTravelDeletes((current) => current.filter((item) => item.record.id !== id));
  };

  const confirmTravelHistoryMerge = (payload: { name: string; startDate: string; endDate: string }) => {
    const selectedRecords = travelHistory.filter((record) => travelHistorySelectedIds.includes(record.id));
    if (selectedRecords.length < 2) return;
    const merged = mergeTravelHistoryRecords(
      selectedRecords,
      payload.name,
      payload.startDate,
      payload.endDate,
      CATEGORIES,
    );
    setTravelHistory((current) => [merged, ...current.filter((record) => !travelHistorySelectedIds.includes(record.id))]);
    setTravelMergeModalOpen(false);
    setTravelHistoryMergeMode(false);
    setTravelHistorySelectedIds([]);
    setTravelHistoryRailOpen(true);
    setTravelStatus(`已合并 ${selectedRecords.length} 条旅游记录为「${merged.name}」。`);
  };

  const selectedMergeRecords = useMemo(
    () => travelHistory.filter((record) => travelHistorySelectedIds.includes(record.id)),
    [travelHistory, travelHistorySelectedIds],
  );
  const mergeDefaults = useMemo(
    () => (selectedMergeRecords.length ? buildMergeDefaults(selectedMergeRecords) : null),
    [selectedMergeRecords],
  );

  const exportTravelBill = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["section", "date", "category", "amount", "currency", "converted", "targetCurrency", "note"],
      ...travelCategorySummary.map((item) => [
        "category",
        "",
        item.category,
        "",
        "",
        formatMoney(item.value, travelState.targetCurrency),
        travelState.targetCurrency,
        `${item.percent.toFixed(1)}%`,
      ]),
      ...travelDetails.map((entry) => [
        "detail",
        entry.date,
        entry.category,
        entry.amount,
        entry.currency,
        formatMoney(convert(parseAmount(entry.amount), entry.currency, travelState.targetCurrency, exchange), travelState.targetCurrency),
        travelState.targetCurrency,
        entry.note,
      ]),
    ];
    const csv = rows.map((row) => row.map(quote).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${travelState.billName ?? "旅游账单"}-${travelState.startDate ?? selectedDate}-${travelEndDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const trendRows = useMemo(() => {
    const selected = parseDateKey(`${monthKey}-01`);
    return Array.from({ length: trendMonths }, (_, index) => {
      const date = new Date(selected);
      date.setMonth(selected.getMonth() - (trendMonths - 1 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const entries = collectEntries(ledger, (entryDate) => getMonthKey(entryDate) === key);
      const totals = getEntryTotals(entries, exchange, allCurrencies);
      return { month: key, value: totals.converted[trendCurrency] ?? 0 };
    });
  }, [allCurrencies, exchange, ledger, monthKey, trendCurrency, trendMonths]);

  const trendValues = trendRows.map((row) => row.value);
  const trendMin = Math.min(0, ...trendValues);
  const trendMax = Math.max(1, ...trendValues);
  const trendPoints = trendRows
    .map((row, index) => {
      const x = trendRows.length === 1 ? 300 : 24 + (index / (trendRows.length - 1)) * 552;
      const y = 188 - ((row.value - trendMin) / (trendMax - trendMin || 1)) * 156;
      return `${x},${y}`;
    })
    .join(" ");
  const targetRateCurrency = dailyDefaultCurrency === "CNY" ? "HKD" : "CNY";
  const todayRecordCount = selectedEntries.filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0).length;
  const todayHiddenCount = selectedEntries.filter((entry) => entry.hidden && hasEntryContent(entry)).length;
  const monthLedgerDayCount = new Set(
    monthEntries
      .filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0)
      .map((entry) => entry.date),
  ).size;
  const weekTopCategory = weekCategorySummary.reduce(
    (top, item) => (Math.abs(item.value) > Math.abs(top.value) ? item : top),
    { category: "暂无", value: 0, percent: 0, color: "#89CFF0" },
  );
  const fortunePool = ["上上签，很适合记账", "小确幸，适合补备注", "好运在线，账目会很乖", "清爽签，今天表格很听话", "灵感签，分类一眼分明"];
  const todayFortune = fortunePool[hashSeed(selectedDate) % fortunePool.length];
  const funDataCards = useMemo<FunDataCard[]>(
    () => [
      {
        id: "currency",
        title: "今日默认货币",
        value: dailyDefaultCurrency,
        hint: getCurrencyMeta(dailyDefaultCurrency).name,
        variant: "mint",
        effect: "float",
        accent: "#4cb9ca",
      },
      {
        id: "streak",
        title: "连续记账天数",
        value: `${streakDays} 天`,
        hint: streakDays ? "节奏感正在发光" : "今天记一笔就开张",
        variant: "sunset",
        effect: "pulse",
        accent: "#f2a191",
      },
      {
        id: "rate",
        title: "今日默认汇率",
        value: `1 ${dailyDefaultCurrency}`,
        hint: `≈ ${convert(1, dailyDefaultCurrency, targetRateCurrency, exchange).toFixed(4)} ${targetRateCurrency}`,
        variant: "blue",
        effect: "tilt",
        accent: "#5b8cff",
      },
      {
        id: "fortune",
        title: "今天记账运势",
        value: todayFortune,
        hint: "宇宙建议：顺手补一笔",
        variant: "gold",
        effect: "spark",
        accent: "#e6c46c",
      },
      {
        id: "today-count",
        title: "今日已记几笔",
        value: `${todayRecordCount} 笔`,
        hint: todayRecordCount ? "账本已经热身完成" : "第一笔正在等你",
        variant: "aqua",
        effect: "orbit",
        accent: "#74e8d8",
      },
      {
        id: "today-net",
        title: "今日净支出",
        value: formatMoney(dayTotals.converted[dailyDefaultCurrency], dailyDefaultCurrency),
        hint: "按当前默认货币换算",
        variant: "rose",
        effect: "flip",
        accent: "#ff7a90",
      },
      {
        id: "week-top",
        title: "本周最高分类",
        value: weekTopCategory.category,
        hint: weekTopCategory.value ? `${formatMoney(weekTopCategory.value, dailyDefaultCurrency)} · ${weekTopCategory.percent.toFixed(0)}%` : "本周还很清爽",
        variant: "violet",
        effect: "tilt",
        accent: "#b4a7d6",
      },
      {
        id: "hidden",
        title: "隐藏记录数量",
        value: `${todayHiddenCount} 条`,
        hint: todayHiddenCount ? "这些记录暂不参与统计" : "今天没有藏起来的小票",
        variant: "slate",
        effect: "float",
        accent: "#94a3b8",
      },
      {
        id: "theme",
        title: "当前主题",
        value: themeMode === "dark" ? "夜间模式" : "浅色模式",
        hint: themeMode === "dark" ? "玻璃微光已点亮" : "清透日光营业中",
        variant: "night",
        effect: "spark",
        accent: "#356fd7",
      },
      {
        id: "travel",
        title: "旅游模式状态",
        value: travelState.active ? "旅行中" : "本地日常",
        hint: travelState.active ? `目的地货币 ${travelState.destinationCurrency}` : "随时可以开启旅途账本",
        variant: "lime",
        effect: "orbit",
        accent: "#90ded1",
      },
      {
        id: "custom-currencies",
        title: "自定义货币",
        value: `${customCurrencies.length} 种`,
        hint: customCurrencies.length ? customCurrencies.join(" / ") : "可添加更多目的地货币",
        variant: "peach",
        effect: "pulse",
        accent: "#ffd6a5",
      },
      {
        id: "month-days",
        title: "本月记账天数",
        value: `${monthLedgerDayCount} 天`,
        hint: `${monthKey} 的小小足迹`,
        variant: "cyan",
        effect: "flip",
        accent: "#89cff0",
      },
    ],
    [
      customCurrencies,
      dailyDefaultCurrency,
      dayTotals,
      exchange,
      monthKey,
      monthLedgerDayCount,
      streakDays,
      targetRateCurrency,
      themeMode,
      todayFortune,
      todayHiddenCount,
      todayRecordCount,
      travelState.active,
      travelState.destinationCurrency,
      weekTopCategory,
    ],
  );
  const displayedFunCards = useMemo(
    () => pickStableItems(funDataCards, `${selectedDate}:${funCardShuffleSalt}`, 3),
    [funCardShuffleSalt, funDataCards, selectedDate],
  );

  const handleFunCardPointerEnter = (event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const card = event.currentTarget;
    const effect = card.dataset.effect;
    const rotation = effect === "tilt" ? 2.2 : effect === "flip" ? -1.6 : 0.8;
    const y = effect === "orbit" ? -12 : -8;
    gsap.to(card, {
      y,
      scale: effect === "pulse" ? 1.045 : 1.028,
      rotation,
      duration: 0.34,
      ease: "back.out(1.8)",
      overwrite: "auto",
    });
    gsap.to(card.querySelector(".fun-card-shine"), {
      xPercent: 135,
      autoAlpha: 0.72,
      duration: 0.58,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(card.querySelector(".fun-card-orb"), {
      scale: 1.18,
      rotation: effect === "spark" ? 24 : 10,
      duration: 0.38,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleFunCardPointerLeave = (event: PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    const card = event.currentTarget;
    gsap.to(card, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      duration: 0.48,
      ease: "elastic.out(1, 0.55)",
      overwrite: "auto",
    });
    gsap.to(card.querySelector(".fun-card-shine"), {
      xPercent: -120,
      autoAlpha: 0,
      duration: 0.24,
      ease: "power1.out",
      overwrite: "auto",
    });
    gsap.to(card.querySelector(".fun-card-orb"), {
      scale: 1,
      rotation: 0,
      duration: 0.34,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  return (
    <main className="app-shell" ref={appRootRef}>
      <div className="app-main">
      <header className="hero">
        <div className="hero-copy-card">
          <div className="hero-copy">
            <p className="eyebrow">月度智能记账本</p>
            <h1 className="hero-title" data-text={`这是你坚持记账的第${streakDays}天`}>
              这是你坚持记账的第{streakDays}天
            </h1>
            <p>连续天数按当前选择日期向前计算，仅统计非隐藏且金额非 0 的有效记录。</p>
          </div>
          <div className="hero-fun-zone">
            <div className="streak-glass" aria-label="连续记账天数">
              <span>Ledger Streak</span>
              <strong>{streakDays}</strong>
              <small>{streakDays ? "继续保持这个节奏" : "今天记一笔即可开启连续天数"}</small>
            </div>
            <section className="fun-data-dock" aria-label="趣味数据小卡片">
              <div className="fun-data-heading">
                <span>今日小数据</span>
                <button type="button" className="shuffle-fun-button" onClick={() => setFunCardShuffleSalt((salt) => salt + 1)}>
                  换一组
                </button>
              </div>
              <div className="fun-data-grid">
                {displayedFunCards.map((card) => (
                  <article
                    key={card.id}
                    className={`fun-data-card fun-card-${card.variant}`}
                    data-effect={card.effect}
                    style={{ "--fun-accent": card.accent } as CSSProperties}
                    onPointerEnter={handleFunCardPointerEnter}
                    onPointerLeave={handleFunCardPointerLeave}
                  >
                    <span className="fun-card-orb" aria-hidden="true" />
                    <span className="fun-card-shine" aria-hidden="true" />
                    <p>{card.title}</p>
                    <strong>{card.value}</strong>
                    <small>{card.hint}</small>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
        <div className="hero-side-panel" aria-label="记账控制区">
          <section className="date-card date-control-card">
            <div>
              <p className="eyebrow">Ledger Date</p>
              <h2>记账日期</h2>
              <p className="muted">加载时先使用本地系统日期，并尝试联网校准。</p>
            </div>
            <button className="date-display-button" type="button" onClick={() => setDatePickerOpen(true)}>
              <span>{selectedDate}</span>
              <strong>{formatMonthDay(selectedDate)}</strong>
              <em>{formatWeekday(selectedDate)}</em>
            </button>
            <div className="date-quick-actions" aria-label="日期快捷切换">
              <button type="button" className="secondary-button" onClick={() => moveSelectedDate(-1)}>
                前一天
              </button>
              <button type="button" onClick={jumpToToday}>
                今天
              </button>
              <button type="button" className="secondary-button" onClick={() => moveSelectedDate(1)}>
                后一天
              </button>
            </div>
          </section>

          <section className="date-card default-currency-card">
            <div className="daily-default-controls">
              <span className="control-label">今日默认货币</span>
              <div
                className="currency-switch"
                data-selected={isPrimaryCurrency(dailyDefaultCurrency) ? dailyDefaultCurrency : "OTHERS"}
                role="group"
                aria-label="今日默认货币"
              >
                {PRIMARY_CURRENCIES.map((currency) => (
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
                <button
                  type="button"
                  className={!isPrimaryCurrency(dailyDefaultCurrency) ? "currency-switch-option active" : "currency-switch-option"}
                  onClick={() => setCurrencyModal({ type: "daily-default" })}
                  aria-pressed={!isPrimaryCurrency(dailyDefaultCurrency)}
                  title="选择其他今日默认货币"
                >
                  Others
                  {!isPrimaryCurrency(dailyDefaultCurrency) && (
                    <small>{dailyDefaultCurrency}</small>
                  )}
                </button>
              </div>
              <strong className="currency-badge">当前：{getCurrencyLabel(dailyDefaultCurrency)}</strong>
            </div>
            <div className="rate-actions" aria-label="汇率操作">
              <button type="button" className="secondary-button" onClick={() => setExchangeTableOpen(true)}>
                汇率表格
              </button>
              <button type="button" onClick={refreshExchange}>
                汇率刷新
              </button>
            </div>
            <p className="status">{rateStatus}</p>
          </section>
        </div>
      </header>

      <section className="card natural-ledger-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Local Language Ledger</p>
            <h2>自然语言记账</h2>
            <p className="muted">
              输入一句或多句消费描述，只在浏览器本地用规则整理为可审阅记录，再导入当前账本。
            </p>
          </div>
          <div className="local-parser-chip">
            本地规则解析 · 无云端请求
          </div>
        </div>
        <div className="natural-ledger-input-grid">
          <label>
            账单描述
            <textarea
              value={naturalLedgerInput}
              onChange={(event) => setNaturalLedgerInput(event.target.value)}
              placeholder={"例如：\n昨天早餐 20 午餐 50，打车 42 HKD，空调费 120 港币\n6月8日 手机费 88 CNY；退款 20 港币"}
              rows={5}
            />
          </label>
          <div className="natural-ledger-actions">
            <button type="button" onClick={parseNaturalLedgerInput} disabled={isParsingNaturalLedger || !naturalLedgerInput.trim()}>
              {isParsingNaturalLedger ? "整理中..." : "一键整理记账"}
            </button>
            <button type="button" className="secondary-button" onClick={clearNaturalLedgerInput}>
              清空
            </button>
          </div>
        </div>
        {naturalLedgerStatus && <p className="status">{naturalLedgerStatus}</p>}
        {naturalLedgerWarnings.length > 0 && (
          <div className="natural-ledger-warnings" role="status">
            {naturalLedgerWarnings.map((warning, index) => (
              <span key={`${warning}-${index}`}>{warning}</span>
            ))}
          </div>
        )}
        {naturalLedgerPreview.length > 0 && (
          <div className="natural-ledger-preview" ref={naturalPreviewRef}>
            <div className="preview-heading">
              <div>
                <strong>待导入记录预览</strong>
                <span>解析后仍可逐条调整日期、分类、金额、货币和备注。</span>
              </div>
              <div className="preview-actions">
                <button type="button" className="secondary-button" onClick={addNaturalLedgerPreviewRecord}>
                  新增一条
                </button>
                <button type="button" onClick={confirmNaturalLedgerImport} disabled={!canImportNaturalLedgerPreview}>
                  确认导入 {naturalLedgerPreview.length} 条
                </button>
              </div>
            </div>
            <div className="natural-ledger-table-wrap">
              <table className="natural-ledger-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>分类</th>
                    <th>金额</th>
                    <th>货币</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {naturalLedgerPreview.map((record, index) => {
                    const issues = naturalLedgerPreviewIssues[index] ?? [];
                    return (
                      <tr key={`${record.date}-${record.category}-${record.amount}-${index}`} className={issues.length ? "invalid-preview-row" : undefined}>
                        <td>
                          <input
                            type="date"
                            value={record.date}
                            onChange={(event) => updateNaturalLedgerPreviewRecord(index, "date", event.target.value)}
                            className={!isValidDateKey(record.date) ? "invalid" : ""}
                            aria-label={`第 ${index + 1} 条日期`}
                          />
                        </td>
                        <td>
                          <select
                            value={record.category}
                            onChange={(event) => updateNaturalLedgerPreviewRecord(index, "category", event.target.value)}
                            className={!CATEGORIES.includes(record.category) ? "invalid" : ""}
                            aria-label={`第 ${index + 1} 条分类`}
                          >
                            {CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            inputMode="decimal"
                            value={record.amount}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (/^-?\d*\.?\d{0,2}$/.test(value) || value === "-" || value === "") {
                                updateNaturalLedgerPreviewRecord(index, "amount", value);
                              }
                            }}
                            className={!/^-?\d+(?:\.\d{1,2})?$/.test(record.amount.trim()) || parseAmount(record.amount) === 0 ? "invalid" : ""}
                            placeholder="0.00"
                            aria-label={`第 ${index + 1} 条金额`}
                          />
                        </td>
                        <td>
                          <select
                            value={record.currency}
                            onChange={(event) => updateNaturalLedgerPreviewRecord(index, "currency", event.target.value)}
                            className={!allCurrencies.includes(record.currency) ? "invalid" : ""}
                            aria-label={`第 ${index + 1} 条货币`}
                          >
                            {allCurrencies.map((currency) => (
                              <option key={currency} value={currency}>
                                {currency}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            value={record.note}
                            onChange={(event) => updateNaturalLedgerPreviewRecord(index, "note", event.target.value)}
                            placeholder="备注"
                            aria-label={`第 ${index + 1} 条备注`}
                          />
                          {issues.length > 0 && <small className="preview-row-error">{issues.join(" / ")}</small>}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="delete-record-button"
                            onClick={() => deleteNaturalLedgerPreviewRecord(index)}
                            aria-label={`删除第 ${index + 1} 条待导入记录`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className={`card ledger-card stat-variant-${statVariant}`}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">每日明细</p>
            <h2>{selectedDate} 日记账</h2>
          </div>
          <div className="daily-total">
            <span>当日总支出 · {dailyDefaultCurrency} 口径</span>
            <strong>{formatMoney(dayTotals.converted[dailyDefaultCurrency], dailyDefaultCurrency)}</strong>
          </div>
        </div>

        <div className="ledger-table-shell" ref={ledgerShellRef}>
          <div className="ledger-add-rail" aria-label="添加记录">
            {CATEGORIES.map((category, categoryIndex) => {
              const canAdd = visibleRowCounts[categoryIndex] < MAX_RECORDS_PER_CATEGORY;
              return (
                <button
                  key={category}
                  className="add-record-button"
                  style={{ top: `${addButtonTops[categoryIndex] ?? 0}px` }}
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
              );
            })}
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
                    const recordActionLabel = currentRowCount <= 1 ? "清空记录" : "删除记录";
                    const recordActionAriaLabel =
                      currentRowCount <= 1
                        ? `清空${category}第${rowIndex + 1}条记录`
                        : `删除${category}第${rowIndex + 1}条记录`;
                    const hiddenActionLabel = entry.hidden ? "取消隐藏，重新计入统计" : "隐藏此记录，不计入统计";
                    return (
                      <tr
                        key={`${category}-${rowIndex}`}
                        className={entry.hidden ? "hidden-entry-row" : undefined}
                        ref={
                          rowIndex === 0
                            ? (element) => {
                                categoryRowRefs.current[categoryIndex] = element;
                              }
                            : undefined
                        }
                      >
                        {rowIndex === 0 && (
                          <th rowSpan={currentRowCount} className="category-cell">
                            <span>{category}</span>
                          </th>
                        )}
                      <td className="slot-cell">
                        <span>#{rowIndex + 1}</span>
                        {entry.hidden && <small>已隐藏，不计入统计</small>}
                      </td>
                      <td>
                        <input
                          data-date={selectedDate}
                          data-index={index}
                          data-field="amount"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={entry.amount}
                          onChange={(event) => handleAmountChange(index, event.target.value)}
                          onKeyDown={(event) => handleInputKeyDown(event, categoryIndex, rowIndex, "amount")}
                          className={entry.amount && parseAmount(entry.amount) === 0 ? "invalid" : ""}
                          title={entry.hidden ? "已隐藏，不计入统计" : undefined}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="currency-select-button"
                          data-date={selectedDate}
                          data-index={index}
                          data-field="currency"
                          onClick={() => setCurrencyModal({ type: "entry", index, category, rowIndex })}
                          title={`选择${category}第${rowIndex + 1}条记录货币`}
                          aria-label={`当前货币 ${getCurrencyLabel(entry.currency)}，点击选择其他货币`}
                        >
                          <span>{entry.currency}</span>
                          <small>{getCurrencyMeta(entry.currency).shortName}</small>
                        </button>
                      </td>
                      <td>
                        <input
                          data-date={selectedDate}
                          data-index={index}
                          data-field="note"
                          placeholder="备注"
                          value={entry.note}
                          onChange={(event) => updateEntry(index, { note: event.target.value })}
                          onKeyDown={(event) => handleInputKeyDown(event, categoryIndex, rowIndex, "note")}
                        />
                      </td>
                      <td className="record-actions">
                        <div className="record-actions-inner">
                          <button
                            type="button"
                            className={entry.hidden ? "hide-record-button active" : "hide-record-button"}
                            title={hiddenActionLabel}
                            aria-label={`${hiddenActionLabel}：${category}第${rowIndex + 1}条记录`}
                            aria-pressed={entry.hidden}
                            onClick={() => toggleEntryHidden(index)}
                          >
                            {entry.hidden ? "◌" : "○"}
                          </button>
                          <button
                            type="button"
                            className="delete-record-button"
                            title={recordActionLabel}
                            aria-label={recordActionAriaLabel}
                            onClick={() => deleteCategoryRecord(categoryIndex, rowIndex)}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                      {rowIndex === 0 && (
                        <td rowSpan={currentRowCount} className="subtotal-cell">
                          {safeDisplayStatsCurrencies.map((currency, currencyIndex) =>
                            currencyIndex === 0 ? (
                              <strong key={currency}>{formatMoney(categoryTotal.converted[currency], currency)}</strong>
                            ) : (
                              <span key={currency}>{formatMoney(categoryTotal.converted[currency], currency)}</span>
                            ),
                          )}
                        </td>
                      )}
                    </tr>
                  );
                }),
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="keyboard-hints" aria-label="记账表格快捷键提示">
          <span><kbd>Enter</kbd> 添加本类目下一条记录</span>
          <span><kbd>Tab</kbd> 跳到下一类目金额</span>
          <span><kbd>↑/↓</kbd> 上下移动</span>
          <span><kbd>←/→</kbd> 左右切换输入格</span>
        </div>
        {shortcutFeedback && <p className="shortcut-feedback" role="status">{shortcutFeedback}</p>}
      </section>

      <div className="stats-grid">
        {renderStatsCard(
          weekTitle,
          "自然周（周一至周日）",
          weekTotals,
          weekCategorySummary,
          "week",
          (statVariant + 1) % 3,
        )}
        {renderStatsCard("本月统计 / 月度总结", monthKey, monthTotals, monthCategorySummary, "month", (statVariant + 2) % 3)}
      </div>

      <div className="travel-mode-zone">
      <section className="card travel-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Travel Mode</p>
            <h2>{travelState.active && travelState.billName ? travelState.billName : "旅游模式"}</h2>
            <p className="muted">{travelRangeLabel}</p>
            {travelState.active && travelState.locationLabel && (
              <p className="muted">定位参考：{travelState.locationLabel}</p>
            )}
          </div>
          <div className="travel-header-actions">
            {travelHistory.length > 0 && (
              <button
                type="button"
                className="travel-history-toggle"
                onClick={() => setTravelHistoryRailOpen((open) => !open)}
                aria-expanded={travelHistoryRailOpen}
                aria-controls="travel-history-panel"
                aria-label={travelHistoryRailOpen ? "关闭记账历史" : "旅游记账历史"}
                title={travelHistoryRailOpen ? "关闭记账历史" : "查看旅游记账历史"}
              >
                <span>{travelHistoryRailOpen ? "关闭记账历史" : "旅游记账历史"}</span>
                <em>{travelHistory.length}</em>
              </button>
            )}
            <button
              type="button"
              onClick={travelState.active ? endTravelMode : enableTravelMode}
              title={travelState.active ? "结束当前旅游记账" : "开始旅游记账"}
              aria-label={travelState.active ? "结束旅游" : "开始旅游记账"}
            >
              {travelState.active ? "结束旅游" : "开始旅游记账"}
            </button>
          </div>
        </div>

        {!travelState.active && (
          <div className="travel-setup-grid">
            <label>
              旅游账单名称
              <input
                value={travelDraftBillName}
                placeholder={buildFallbackBillName(travelState.destinationCurrency)}
                onChange={(event) => setTravelDraftBillName(event.target.value)}
              />
            </label>
            <label>
              开始日期
              <input
                type="date"
                value={travelDraftStartDate}
                onChange={(event) => setTravelDraftStartDate(event.target.value)}
              />
            </label>
            <label className="travel-end-date-toggle">
              <span>预设结束日期</span>
              <input
                type="checkbox"
                checked={travelDraftUseEndDate}
                onChange={(event) => setTravelDraftUseEndDate(event.target.checked)}
              />
            </label>
            <label className={travelDraftUseEndDate ? "" : "is-disabled"}>
              结束日期
              <input
                type="date"
                value={travelDraftEndDate}
                disabled={!travelDraftUseEndDate}
                min={travelDraftStartDate}
                onChange={(event) => setTravelDraftEndDate(event.target.value)}
              />
            </label>
          </div>
        )}

        <div className="travel-controls">
          <label>
            目的地默认货币
            <select
              value={travelState.destinationCurrency}
              onChange={(event) => {
                const currency = event.target.value;
                setTravelState((current) => ({ ...current, destinationCurrency: currency }));
                if (travelState.active) switchDailyDefaultCurrency(currency);
              }}
            >
              {allCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency} · {getCurrencyMeta(currency).shortName}</option>
              ))}
            </select>
          </label>
          <label>
            账单换算目标货币
            <select
              value={travelState.targetCurrency}
              onChange={(event) => setTravelState((current) => ({ ...current, targetCurrency: event.target.value }))}
            >
              {allCurrencies.map((currency) => (
                <option key={currency} value={currency}>{currency} · {getCurrencyMeta(currency).shortName}</option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={exportTravelBill} disabled={!travelDetails.length}>
            导出旅游账单
          </button>
        </div>
        {travelStatus && <p className="status travel-status-banner">{travelStatus}</p>}
        {travelState.active && (
        <div className="travel-bill">
          <div className="totals-grid">
            <div>
              <span>旅游总额 · {travelState.targetCurrency}</span>
              <strong>{formatMoney(travelTotals.converted[travelState.targetCurrency] ?? 0, travelState.targetCurrency)}</strong>
            </div>
            <div>
              <span>有效明细</span>
              <strong>{travelDetails.length} 条</strong>
            </div>
          </div>
          <div className="chart-row">
            <PieChart summary={travelCategorySummary} title="旅游账单" />
            <div className="summary-list">
              {travelCategorySummary.length ? travelCategorySummary.map((item) => (
                <div key={item.category}>
                  <span>{item.category}</span>
                  <strong>{formatMoney(item.value, travelState.targetCurrency)} · {item.percent.toFixed(1)}%</strong>
                </div>
              )) : <p className="muted">当前范围还没有旅游账单数据。</p>}
            </div>
          </div>
          <div className="travel-details">
            {travelDetails.slice(0, 12).map((entry, index) => (
              <div key={`${entry.date}-${entry.category}-${index}`}>
                <span>{entry.date} · {entry.category}</span>
                <strong>{formatMoney(convert(parseAmount(entry.amount), entry.currency, travelState.targetCurrency, exchange), travelState.targetCurrency)}</strong>
                <small>{entry.amount} {entry.currency}{entry.note ? ` · ${entry.note}` : ""}</small>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>

      <TravelHistoryPanel
        records={travelHistory}
        open={travelHistoryRailOpen}
        mergeMode={travelHistoryMergeMode}
        selectedIds={travelHistorySelectedIds}
        editingId={travelHistoryEditingId}
        editingName={travelHistoryEditingName}
        onToggleOpen={() => setTravelHistoryRailOpen((open) => !open)}
        onSelectRecord={(id) => {
          setSelectedTravelHistoryId(id);
          setTravelHistoryRailOpen(false);
        }}
        onToggleMergeMode={() => {
          setTravelHistoryMergeMode((mode) => !mode);
          setTravelHistorySelectedIds([]);
          setTravelHistoryEditingId(null);
        }}
        onToggleSelected={(id) =>
          setTravelHistorySelectedIds((current) =>
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
          )
        }
        onStartMerge={() => setTravelMergeModalOpen(true)}
        onStartRename={(record) => {
          setTravelHistoryEditingId(record.id);
          setTravelHistoryEditingName(record.name);
        }}
        onEditingNameChange={setTravelHistoryEditingName}
        onSaveRename={saveTravelHistoryRename}
        onCancelRename={() => {
          setTravelHistoryEditingId(null);
          setTravelHistoryEditingName("");
        }}
        onDeleteRecord={deleteTravelHistoryRecord}
        formatMoney={formatMoney}
      />
      </div>

      {pendingTravelDeletes.length > 0 && (
        <div className="travel-delete-toast-stack" aria-live="polite">
          {pendingTravelDeletes.map((pending) => {
            const remainingMs = PENDING_DELETE_TTL_MS - (Date.now() - pending.deletedAt);
            const remainingSec = Math.max(1, Math.ceil(remainingMs / 1000));
            void deleteToastTick;
            return (
              <aside key={pending.record.id} className="travel-delete-toast" role="status">
                <p>「{pending.record.name}」已删除，{remainingSec} 秒内可恢复</p>
                <div className="travel-delete-toast-actions">
                  <button type="button" onClick={() => undoTravelHistoryDelete(pending.record.id)}>
                    撤销
                  </button>
                </div>
              </aside>
            );
          })}
        </div>
      )}

      <section className="card trend-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Monthly Trend</p>
            <h2>近 N 个月花费对比</h2>
          </div>
          <div className="trend-controls">
            <label>
              月数
              <select value={trendMonths} onChange={(event) => setTrendMonths(Number(event.target.value))}>
                <option value={3}>3 个月</option>
                <option value={6}>6 个月</option>
                <option value={12}>12 个月</option>
              </select>
            </label>
            <label>
              统计口径
              <select value={trendCurrency} onChange={(event) => setTrendCurrency(event.target.value)}>
                {allCurrencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <svg className="trend-chart" viewBox="0 0 600 220" role="img" aria-label="近 N 个月月度总花费折线图">
          <line x1="24" y1="188" x2="576" y2="188" />
          <polyline points={trendPoints} />
          {trendRows.map((row, index) => {
            const x = trendRows.length === 1 ? 300 : 24 + (index / (trendRows.length - 1)) * 552;
            const y = 188 - ((row.value - trendMin) / (trendMax - trendMin || 1)) * 156;
            return (
              <g key={row.month}>
                <circle cx={x} cy={y} r="4" />
                <text x={x} y="208">{row.month.slice(5)}</text>
              </g>
            );
          })}
        </svg>
        <div className="trend-list">
          {trendRows.map((row) => (
            <span key={row.month}>{row.month}: {formatMoney(row.value, trendCurrency)}</span>
          ))}
        </div>
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

      <button
        type="button"
        className="floating-theme-toggle"
        onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
        title={themeMode === "dark" ? "切换浅色模式" : "切换夜间模式"}
        aria-label={themeMode === "dark" ? "切换浅色模式" : "切换夜间模式"}
        aria-pressed={themeMode === "dark"}
      >
        <span aria-hidden="true">{themeMode === "dark" ? "☀" : "☾"}</span>
      </button>

      <footer className="site-signature">@FoodieFred Developed</footer>
      </div>

      {backupReminderVisible && (
        <aside className="backup-reminder" role="status" aria-live="polite">
          <p>建议定期导出 CSV 备份。数据保存在浏览器 LocalStorage 中，清理缓存或换设备后可能丢失。</p>
          <div className="backup-reminder-actions">
            <button type="button" onClick={exportCsv}>立即导出</button>
            <button type="button" className="ghost-button" onClick={() => dismissBackupReminder(false)}>
              7 天内不再提醒
            </button>
            <button type="button" className="secondary-button" onClick={() => dismissBackupReminder(true)}>
              不再提醒
            </button>
          </div>
        </aside>
      )}

      {datePickerOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeDatePicker} ref={modalRootRef}>
          <section
            className="modal-card date-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="date-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Date Console</p>
                <h2 id="date-modal-title">选择记账日期</h2>
                <p className="muted">当前选择：{selectedDate} · {formatMonthDay(selectedDate)} · {formatWeekday(selectedDate)}</p>
              </div>
              <button className="ghost-button" type="button" onClick={closeDatePicker} aria-label="关闭日期选择">
                关闭
              </button>
            </div>
            <div className="date-modal-panel">
              <label>
                日期
                <input type="date" value={selectedDate} onChange={(event) => commitDateChange(event.target.value)} />
              </label>
              <div className="date-modal-actions" aria-label="日期快捷操作">
                <button type="button" className="secondary-button" onClick={() => moveSelectedDate(-1)}>
                  前一天
                </button>
                <button type="button" onClick={jumpToToday}>
                  回到今天
                </button>
                <button type="button" className="secondary-button" onClick={() => moveSelectedDate(1)}>
                  后一天
                </button>
              </div>
              <p className="date-modal-note">切换日期会沿用原有逻辑，将今日默认货币重置为 HKD，并保持已保存的每日账目独立存储。</p>
            </div>
          </section>
        </div>
      )}

      {currencyModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeCurrencyModal} ref={modalRootRef}>
          <section
            className="modal-card currency-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="currency-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Currency Palette</p>
                <h2 id="currency-modal-title">
                  {currencyModal.type === "daily-default"
                    ? "选择今日默认货币"
                    : `选择${currencyModal.category}第${currencyModal.rowIndex + 1}条货币`}
                </h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeCurrencyModal} aria-label="关闭货币选择">
                关闭
              </button>
            </div>
            <div className="currency-modal-grid">
              {allCurrencies.map((currency) => {
                const active =
                  currencyModal.type === "daily-default"
                    ? dailyDefaultCurrency === currency
                    : selectedEntries[currencyModal.index]?.currency === currency;
                return (
                  <button
                    key={currency}
                    type="button"
                    className={active ? "currency-card-option active" : "currency-card-option"}
                    onClick={() => handleCurrencySelect(currency)}
                    aria-pressed={active}
                  >
                    <strong>{currency}</strong>
                    <span>{getCurrencyMeta(currency).name}</span>
                    {currency === "NTD" && <small>API 按 TWD 请求</small>}
                  </button>
                );
              })}
            </div>
            <div className="custom-currency-box">
              <label>
                添加自定义货币
                <input
                  value={customCurrencyCode}
                  maxLength={3}
                  placeholder="例如 CAD"
                  onChange={(event) => {
                    setCustomCurrencyCode(event.target.value.toUpperCase());
                    setCustomCurrencyError("");
                  }}
                />
              </label>
              <button type="button" onClick={addCustomCurrency}>添加</button>
              {customCurrencyError && <p className="error-text">{customCurrencyError}</p>}
              <p className="muted">仅接受 ISO 4217 三字母代号；TWD 会兼容映射为界面中的 NTD。</p>
            </div>
          </section>
        </div>
      )}

      {exchangeTableOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeExchangeTable} ref={modalRootRef}>
          <section
            className="modal-card rate-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rate-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Exchange Matrix</p>
                <h2 id="rate-modal-title">1 {dailyDefaultCurrency} 的兑换汇率</h2>
                <p className="muted">
                  {exchange.source} · {new Date(exchange.updatedAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={closeExchangeTable} aria-label="关闭汇率表格">
                关闭
              </button>
            </div>
            <div className="rate-table">
              {exchangeRows.map(({ currency, value }) => (
                <div key={currency}>
                  <span>{currency}</span>
                  <strong>{value.toFixed(value >= 100 ? 2 : 4)}</strong>
                  <small>{getCurrencyMeta(currency).name}</small>
                </div>
              ))}
            </div>
            <p className="muted">NTD 在外部汇率接口中按 TWD 映射，界面统一展示为 NTD。</p>
          </section>
        </div>
      )}

      {selectedTravelHistory && (
        <TravelHistoryDetailModal
          record={selectedTravelHistory}
          onClose={closeTravelHistoryModal}
          formatMoney={formatMoney}
          modalRootRef={modalRootRef}
        />
      )}

      {travelMergeModalOpen && mergeDefaults && selectedMergeRecords.length >= 2 && (
        <TravelMergeModal
          records={selectedMergeRecords}
          defaultName={mergeDefaults.name}
          defaultStartDate={mergeDefaults.startDate}
          defaultEndDate={mergeDefaults.endDate}
          onConfirm={confirmTravelHistoryMerge}
          onClose={() => setTravelMergeModalOpen(false)}
          modalRootRef={modalRootRef}
        />
      )}
    </main>
  );
}

export default App;
