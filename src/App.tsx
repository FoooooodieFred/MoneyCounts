import { CSSProperties, ChangeEvent, KeyboardEvent, ReactNode, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import {
  LocalLedgerRecord,
  parseNaturalLedger,
} from "./localLedgerParser";
import { HeroSection } from "./components/HeroSection";
import { NaturalLanguageInput } from "./components/NaturalLanguageInput";
import { SettingsModal } from "./components/SettingsModal";
import { FeatureBlock } from "./components/FeatureBlock";
import { SiteFooter } from "./components/SiteFooter";
import { ScrollNav, MobileScrollNav } from "./components/ScrollNav";
import { TodayEntriesList } from "./components/TodayEntriesList";
import { FloatingActions } from "./components/FloatingActions";
import { StatsCurrencyPicker, SummaryModeToggle } from "./components/StatsControls";
import { BudgetOverview } from "./components/BudgetOverview";
import { TravelPage } from "./pages/TravelPage";
import { SettingsPage, BackupImportPreview } from "./pages/SettingsPage";
import { SearchPage, SearchableLedgerRecord } from "./pages/SearchPage";
import type { LedgerBadge, SpendingInsight, WeeklyAchievement } from "./lib/ledgerInsights";
import type { QuickExpenseResult } from "./lib/quickExpenseParser";
import {
  APP_SETTINGS_KEY,
  AppSettings,
  HomeSectionKey,
  normalizeAppSettings,
  readAppSettings,
  saveAppSettings,
} from "./lib/appSettings";
import {
  BACKUP_VERSION,
  MoneyCountsBackupPayload,
  buildBackupPayload,
  makeBackupFilename,
  parseBackupPayload,
  summarizeLedger,
} from "./lib/backup";
import {
  formatMonthDay,
  formatWeekday,
  getDaysInMonth,
  getLedgerStreak,
  getMonthKey,
  getPreviousWeekRange,
  getRemainingDaysForBudget,
  getToday,
  getWeekRange,
  isInRange,
  isValidDateKey,
  parseDateKey,
  shiftDateKey,
} from "./lib/dateRange";
import {
  calculateMonthlyRecordProgress,
  collectEntries as collectLedgerEntries,
  countRecordedDates,
  countVisibleRecords,
  getCategoryEntries as getLedgerCategoryEntries,
  getDefaultRowCounts as getLedgerDefaultRowCounts,
  getEntryIndex as getLedgerEntryIndex,
  hasEntryContent,
  parseAmount,
} from "./lib/ledgerStats";
import {
  DEFAULT_TRAVEL_STATE,
  TravelHistoryRecord,
  TravelState,
  buildBillNameFromLocation,
  buildFallbackBillName,
  detectTravelGeo,
  mergeTravelHistoryRecords,
  normalizeStoredPendingTravelDeletes,
  normalizeStoredTravelHistory,
  normalizeStoredTravelState,
  PENDING_DELETE_TTL_MS,
  PendingTravelHistoryDelete,
  purgeExpiredPendingDeletes,
  readStoredPendingTravelDeletes,
  readStoredTravelHistory,
  readStoredTravelState,
  reconcileTravelParticipants,
  TRAVEL_HISTORY_KEY,
  TRAVEL_HISTORY_PENDING_DELETE_KEY,
  TRAVEL_KEY,
} from "./travelMode";

type Currency = string;
type ApiCurrency = string;
type SummaryMode = "split" | "merged";
type ThemeMode = "light" | "dark";

const LazyPieChart = lazy(() =>
  import("./components/LazyCharts").then((module) => ({ default: module.PieChart })),
);
const LazyTrendChart = lazy(() =>
  import("./components/LazyCharts").then((module) => ({ default: module.TrendChart })),
);

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
  clickable?: boolean;
  progress?: number;
};

type ExchangeCache = {
  base: "USD";
  rates: Record<ApiCurrency, number>;
  updatedAt: number;
  source: string;
};

type BackupReminderState = {
  dismissedAt: number;
  snoozeUntil?: number;
  permanent?: boolean;
};

type PreparedBackupImport = {
  payload: MoneyCountsBackupPayload;
  ledger: LedgerData;
  exchange: ExchangeCache;
  customCurrencies: Currency[];
  lastCurrency: Currency;
  statsCurrencies: Currency[];
  theme: ThemeMode;
  backupReminder: BackupReminderState | null;
  settings: AppSettings;
  travelState: TravelState;
  travelHistory: TravelHistoryRecord[];
  pendingTravelDeletes: PendingTravelHistoryDelete[];
  preview: BackupImportPreview;
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
const PREVIOUS_MAX_RECORDS_PER_CATEGORY = 15;
const MAX_RECORDS_PER_CATEGORY = 50;
const STORAGE_KEY = "monthly-smart-ledger:v1";
const RATE_KEY = "monthly-smart-ledger:exchange";
const LAST_CURRENCY_KEY = "monthly-smart-ledger:last-currency";
const STATS_CURRENCIES_KEY = "monthly-smart-ledger:stats-currencies";
const CUSTOM_CURRENCIES_KEY = "monthly-smart-ledger:custom-currencies";
const THEME_KEY = "monthly-smart-ledger:theme";
const BACKUP_REMINDER_KEY = "monthly-smart-ledger:backup-reminder";
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKUP_REMINDER_COOLDOWN_MS = 3 * DAY_MS;
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

const sanitizeEntry = (entry: Partial<LedgerEntry>, fallbackCurrency: Currency): LedgerEntry => ({
  amount: typeof entry.amount === "string" ? entry.amount : "",
  currency: normalizeCurrencyInput(entry.currency) ?? fallbackCurrency,
  note: typeof entry.note === "string" ? entry.note : "",
  hidden: entry.hidden === true,
});

const getEntryIndex = (categoryIndex: number, rowIndex: number) =>
  getLedgerEntryIndex(categoryIndex, rowIndex, MAX_RECORDS_PER_CATEGORY);

const getCategoryEntries = <T extends LedgerEntry>(entries: T[], categoryIndex: number) =>
  getLedgerCategoryEntries(entries, categoryIndex, MAX_RECORDS_PER_CATEGORY);

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
  if (source.length <= CATEGORIES.length * PREVIOUS_MAX_RECORDS_PER_CATEGORY) {
    const normalized = makeDayEntries("CNY");
    CATEGORIES.forEach((_, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < PREVIOUS_MAX_RECORDS_PER_CATEGORY; rowIndex += 1) {
        const previousIndex = categoryIndex * PREVIOUS_MAX_RECORDS_PER_CATEGORY + rowIndex;
        normalized[getEntryIndex(categoryIndex, rowIndex)] = sanitizeEntry(source[previousIndex] ?? {}, "CNY");
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
    return {
      dismissedAt: parsed.dismissedAt,
      snoozeUntil: typeof parsed.snoozeUntil === "number" ? parsed.snoozeUntil : undefined,
      permanent: parsed.permanent === true,
    };
  } catch {
    return null;
  }
};

const shouldShowBackupReminder = (state: BackupReminderState | null) => {
  if (!state) return true;
  if (state.permanent) return false;
  if (typeof state.snoozeUntil === "number") return Date.now() > state.snoozeUntil;
  return Date.now() - state.dismissedAt > BACKUP_REMINDER_COOLDOWN_MS;
};

const normalizeBackupReminderState = (value: unknown): BackupReminderState | null => {
  if (!value || typeof value !== "object") return null;
  const parsed = value as Partial<BackupReminderState>;
  if (typeof parsed.dismissedAt !== "number") return null;
  return {
    dismissedAt: parsed.dismissedAt,
    snoozeUntil: typeof parsed.snoozeUntil === "number" ? parsed.snoozeUntil : undefined,
    permanent: parsed.permanent === true,
  };
};

const sanitizeBackupEntry = (
  entry: Partial<LedgerEntry>,
  fallbackCurrency: Currency,
  knownCurrencies: readonly Currency[],
): LedgerEntry => ({
  amount: typeof entry.amount === "string" ? entry.amount : "",
  currency: normalizeBackupCurrencyWithKnown(entry.currency, knownCurrencies) ?? fallbackCurrency,
  note: typeof entry.note === "string" ? entry.note : "",
  hidden: entry.hidden === true,
});

const normalizeBackupStoredEntries = (
  entries: Partial<LedgerEntry>[] | undefined,
  knownCurrencies: readonly Currency[],
): LedgerEntry[] => {
  const source = Array.isArray(entries) ? entries : [];
  if (source.length <= CATEGORIES.length * LEGACY_ROWS_PER_CATEGORY) {
    const normalized = makeDayEntries("CNY");
    CATEGORIES.forEach((_, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < LEGACY_ROWS_PER_CATEGORY; rowIndex += 1) {
        const legacyIndex = categoryIndex * LEGACY_ROWS_PER_CATEGORY + rowIndex;
        normalized[getEntryIndex(categoryIndex, rowIndex)] = sanitizeBackupEntry(source[legacyIndex] ?? {}, "CNY", knownCurrencies);
      }
    });
    return normalized;
  }
  if (source.length <= CATEGORIES.length * PREVIOUS_MAX_RECORDS_PER_CATEGORY) {
    const normalized = makeDayEntries("CNY");
    CATEGORIES.forEach((_, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < PREVIOUS_MAX_RECORDS_PER_CATEGORY; rowIndex += 1) {
        const previousIndex = categoryIndex * PREVIOUS_MAX_RECORDS_PER_CATEGORY + rowIndex;
        normalized[getEntryIndex(categoryIndex, rowIndex)] = sanitizeBackupEntry(source[previousIndex] ?? {}, "CNY", knownCurrencies);
      }
    });
    return normalized;
  }
  return Array.from({ length: CATEGORIES.length * MAX_RECORDS_PER_CATEGORY }, (_, index) =>
    sanitizeBackupEntry(source[index] ?? {}, "CNY", knownCurrencies),
  );
};

const normalizeBackupLedger = (value: unknown, knownCurrencies: readonly Currency[]): LedgerData => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("账本结构无效。");
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([date]) => isValidDateKey(date))
      .map(([date, entries]) => [
        date,
        normalizeBackupStoredEntries(Array.isArray(entries) ? entries as Partial<LedgerEntry>[] : [], knownCurrencies),
      ]),
  );
};

const normalizeBackupExchange = (value: unknown, currencies: readonly Currency[]): ExchangeCache => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return readStoredRate();
  const parsed = value as Partial<ExchangeCache>;
  return {
    base: "USD",
    rates: normalizeRates(parsed.rates, currencies),
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    source: typeof parsed.source === "string" ? parsed.source : "导入备份汇率",
  };
};

const normalizeBackupCurrencyWithKnown = (value: unknown, knownCurrencies: readonly Currency[]): Currency | null => {
  const code = normalizeCurrencyCode(value);
  const normalized = code === "TWD" ? "NTD" : code;
  return knownCurrencies.includes(normalized) ? normalized : null;
};

const normalizeBackupCurrencyList = (value: unknown, fallback: Currency[], knownCurrencies: readonly Currency[]): Currency[] => {
  if (!Array.isArray(value)) return fallback;
  const currencies = value
    .map((item) => normalizeBackupCurrencyWithKnown(item, knownCurrencies))
    .filter((currency): currency is Currency => Boolean(currency));
  return currencies.length ? Array.from(new Set(currencies)) : fallback;
};

const getDefaultRowCounts = (entries: LedgerEntry[]) =>
  getLedgerDefaultRowCounts(entries, CATEGORIES, MAX_RECORDS_PER_CATEGORY);

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
  collectLedgerEntries(ledger, CATEGORIES, MAX_RECORDS_PER_CATEGORY, predicate);

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

const sumConvertedEntries = (
  entries: Array<LedgerEntry>,
  exchange: ExchangeCache,
  currency: Currency,
) =>
  entries.reduce((sum, entry) => {
    if (entry.hidden) return sum;
    const amount = parseAmount(entry.amount);
    if (!amount) return sum;
    return sum + convert(amount, entry.currency, currency, exchange);
  }, 0);

type CategorySummary = ReturnType<typeof summarizeByCategory>;

type TravelLedgerEntry = ReturnType<typeof collectEntries>[number];

const getTravelParticipantsForEntry = (entry: TravelLedgerEntry, travelState: TravelState) => {
  const participants = travelState.participants.length ? travelState.participants : DEFAULT_TRAVEL_STATE.participants;
  const selected = travelState.entryMeta[entry.travelKey]?.participantIds.filter((id) =>
    participants.some((participant) => participant.id === id),
  );
  return selected?.length ? selected : participants.map((participant) => participant.id);
};

const buildTravelExchangeSnapshot = (
  amount: number,
  from: Currency,
  to: Currency,
  exchange: ExchangeCache,
) => {
  const convertedAmount = convert(amount, from, to, exchange);
  return {
    from,
    to,
    rate: amount === 0 ? 0 : convertedAmount / amount,
    source: exchange.source,
    updatedAt: exchange.updatedAt,
    convertedAmount,
  };
};

const summarizeTravelSplit = (
  entries: TravelLedgerEntry[],
  travelState: TravelState,
  exchange: ExchangeCache,
) => {
  const participants = travelState.participants.length ? travelState.participants : DEFAULT_TRAVEL_STATE.participants;
  const owed = new Map(participants.map((participant) => [participant.id, 0]));
  for (const entry of entries) {
    if (entry.hidden) continue;
    const amount = parseAmount(entry.amount);
    if (!amount) continue;
    const selectedIds = getTravelParticipantsForEntry(entry, travelState);
    const share = convert(amount, entry.currency, travelState.targetCurrency, exchange) / selectedIds.length;
    selectedIds.forEach((id) => owed.set(id, (owed.get(id) ?? 0) + share));
  }
  return participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    owed: owed.get(participant.id) ?? 0,
  }));
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
  const navigate = useNavigate();
  const location = useLocation();
  const appRootRef = useRef<HTMLDivElement | null>(null);
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
  const [dailySummaryMode, setDailySummaryMode] = useState<SummaryMode>("split");
  const [statsCurrencyPopup, setStatsCurrencyPopup] = useState<"week" | "month" | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("CNY");
  const [dailyDefaultCurrency, setDailyDefaultCurrency] = useState<Currency>("HKD");
  const [selectedStatsCurrencies, setSelectedStatsCurrencies] = useState<Currency[]>(() =>
    readStoredStatsCurrencies("HKD"),
  );
  const [currencyModal, setCurrencyModal] = useState<CurrencyModalState>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [appSettings, setAppSettings] = useState<AppSettings>(() => readAppSettings());
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
  const [celebrationTick, setCelebrationTick] = useState(0);
  const confettiLayerRef = useRef<HTMLDivElement | null>(null);
  const [travelExitModalOpen, setTravelExitModalOpen] = useState(false);
  const [shortcutFeedback, setShortcutFeedback] = useState("");
  const [funCardShuffleSalt, setFunCardShuffleSalt] = useState(() => Math.floor(Math.random() * 100000));
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [quickEntryStatus, setQuickEntryStatus] = useState("");
  const [jsonImportMessage, setJsonImportMessage] = useState("");
  const [preparedJsonImport, setPreparedJsonImport] = useState<PreparedBackupImport | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

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
    saveAppSettings(appSettings);
  }, [appSettings]);

  useEffect(() => {
    localStorage.setItem(TRAVEL_KEY, JSON.stringify(travelState));
  }, [travelState]);

  useEffect(() => {
    document.body.classList.toggle("travel-vacation-theme", travelState.active);
    return () => document.body.classList.remove("travel-vacation-theme");
  }, [travelState.active]);

  useEffect(() => {
    if (location.pathname !== "/" || !location.hash) return;
    const id = location.hash.replace(/^#/, "");
    const target = document.getElementById(id);
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    });
  }, [location.pathname, location.hash]);

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
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedTravelHistoryId) closeTravelHistoryModal();
      else if (currencyModal) closeCurrencyModal();
      else if (datePickerOpen) closeDatePicker();
      else if (travelMergeModalOpen) setTravelMergeModalOpen(false);
      else if (settingsModalOpen) setSettingsModalOpen(false);
      else if (travelHistoryRailOpen) setTravelHistoryRailOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    closeCurrencyModal,
    closeDatePicker,
    closeTravelHistoryModal,
    currencyModal,
    datePickerOpen,
    selectedTravelHistoryId,
    settingsModalOpen,
    travelHistoryRailOpen,
    travelMergeModalOpen,
  ]);

  useEffect(() => {
    const root = appRootRef.current;
    if (!root) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduceMotion) return;

      gsap.to("[data-motion='hero-date'] strong", {
        y: -2,
        duration: 2.4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        overwrite: "auto",
      });
    }, root);

    const hoverTargets = root.querySelectorAll<HTMLElement>(
      "[data-motion='raise-on-hover'], .totals-grid > div, .summary-list > div, .travel-details > div",
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
  }, [datePickerOpen, currencyModal, selectedTravelHistoryId, travelExitModalOpen, travelMergeModalOpen]);

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

  useEffect(() => {
    if (!celebrationTick) return;
    const root = confettiLayerRef.current;
    if (!root) return;
    const pieces = Array.from(root.querySelectorAll<HTMLElement>(".confetti-piece"));
    if (!pieces.length) return;

    const reduceMotion = prefersReducedMotion();
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set(pieces, { autoAlpha: 0 });
        return;
      }
      gsap.set(pieces, { willChange: "transform, opacity" });
      gsap.fromTo(
        pieces,
        {
          x: () => gsap.utils.random(-40, 40),
          y: () => gsap.utils.random(-80, window.innerHeight * 0.12),
          rotation: () => gsap.utils.random(0, 360),
          autoAlpha: 0,
          scale: () => gsap.utils.random(0.55, 1.2),
        },
        {
          x: () => gsap.utils.random(-window.innerWidth * 0.48, window.innerWidth * 0.48),
          y: () => window.innerHeight + gsap.utils.random(60, 180),
          rotation: () => gsap.utils.random(-900, 900),
          autoAlpha: 1,
          scale: () => gsap.utils.random(0.65, 1.15),
          duration: () => gsap.utils.random(1.6, 2.6),
          stagger: { each: 0.012, from: "random" },
          ease: "power2.out",
          overwrite: "auto",
          onComplete: () => gsap.set(pieces, { clearProps: "willChange" }),
        },
      );
    }, root);

    const timer = window.setTimeout(() => setCelebrationTick(0), reduceMotion ? 350 : 2800);
    return () => {
      window.clearTimeout(timer);
      ctx.revert();
    };
  }, [celebrationTick]);

  const commitDateChange = (date: string) => {
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

  const daySplitCurrencies = useMemo(
    () => allCurrencies.filter((currency) => (dayTotals.native[currency] ?? 0) !== 0),
    [allCurrencies, dayTotals],
  );

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

  const allLedgerEntries = useMemo(
    () => collectEntries(ledger, () => true).filter((entry) => !entry.hidden && parseAmount(entry.amount) !== 0),
    [ledger],
  );

  const budgetCurrency = appSettings.budget.currency && allCurrencies.includes(appSettings.budget.currency)
    ? appSettings.budget.currency
    : dailyDefaultCurrency;

  const monthlyBudgetSpent = useMemo(
    () => sumConvertedEntries(monthEntries, exchange, budgetCurrency),
    [budgetCurrency, exchange, monthEntries],
  );

  const categoryBudgetProgress = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const limit = appSettings.budget.categoryLimits[category] ?? 0;
        if (limit <= 0) return null;
        const spent = sumConvertedEntries(
          monthEntries.filter((entry) => entry.category === category),
          exchange,
          budgetCurrency,
        );
        return { category, limit, spent };
      }).filter((item): item is { category: string; limit: number; spent: number } => Boolean(item)),
    [appSettings.budget.categoryLimits, budgetCurrency, exchange, monthEntries],
  );

  const searchRecords = useMemo<SearchableLedgerRecord[]>(
    () =>
      allLedgerEntries
        .map((entry) => ({
          date: entry.date,
          category: entry.category,
          amount: parseAmount(entry.amount),
          currency: entry.currency,
          note: entry.note,
          convertedAmount: convert(parseAmount(entry.amount), entry.currency, budgetCurrency, exchange),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [allLedgerEntries, budgetCurrency, exchange],
  );

  const previousWeekRange = useMemo(() => getPreviousWeekRange(weekRange), [weekRange]);
  const previousWeekEntries = useMemo(
    () => collectEntries(ledger, (date) => isInRange(date, previousWeekRange.start, previousWeekRange.end)),
    [ledger, previousWeekRange.end, previousWeekRange.start],
  );

  const weeklyAchievement = useMemo<WeeklyAchievement>(() => {
    const currentTotal = sumConvertedEntries(weekEntries, exchange, budgetCurrency);
    const previousTotal = sumConvertedEntries(previousWeekEntries, exchange, budgetCurrency);
    const enoughData =
      previousWeekEntries.some((entry) => !entry.hidden && parseAmount(entry.amount) !== 0) &&
      weekEntries.some((entry) => !entry.hidden && parseAmount(entry.amount) !== 0);
    if (!enoughData) {
      return { enoughData: false, savedAmount: 0, categoryMessage: "" };
    }

    const categoryDrops = CATEGORIES.map((category) => {
      const previous = sumConvertedEntries(previousWeekEntries.filter((entry) => entry.category === category), exchange, budgetCurrency);
      const current = sumConvertedEntries(weekEntries.filter((entry) => entry.category === category), exchange, budgetCurrency);
      const dropPercent = previous > 0 && current < previous ? ((previous - current) / previous) * 100 : 0;
      return { category, dropPercent };
    }).filter((item) => item.dropPercent > 0).sort((a, b) => b.dropPercent - a.dropPercent)[0];

    return {
      enoughData: true,
      savedAmount: Math.max(0, previousTotal - currentTotal),
      categoryMessage: categoryDrops
        ? `${categoryDrops.category} 比上周下降 ${categoryDrops.dropPercent.toFixed(0)}%，节奏更轻盈了。`
        : "分类结构保持稳定，继续按自己的节奏记录就好。",
    };
  }, [budgetCurrency, exchange, previousWeekEntries, weekEntries]);

  const spendingInsight = useMemo<SpendingInsight>(() => {
    const end = getToday();
    const start = shiftDateKey(end, -29);
    const weekdayMap = new Map<number, { total: number; days: Set<string> }>();
    allLedgerEntries
      .filter((entry) => isInRange(entry.date, start, end))
      .forEach((entry) => {
        const weekday = parseDateKey(entry.date).getDay();
        const current = weekdayMap.get(weekday) ?? { total: 0, days: new Set<string>() };
        current.total += convert(parseAmount(entry.amount), entry.currency, budgetCurrency, exchange);
        current.days.add(entry.date);
        weekdayMap.set(weekday, current);
      });

    if (weekdayMap.size < 2) return { enoughData: false, message: "" };
    const weekdayLabels = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    const top = Array.from(weekdayMap.entries())
      .map(([weekday, value]) => ({
        weekday,
        average: value.total / Math.max(1, value.days.size),
      }))
      .sort((a, b) => b.average - a.average)[0];
    return {
      enoughData: true,
      message: `近 30 天里，${weekdayLabels[top.weekday]}平均花费最高。可以提前给这一天留一点弹性预算。`,
    };
  }, [allLedgerEntries, budgetCurrency, exchange]);

  const ledgerBadge = useMemo<LedgerBadge>(() => {
    const recordedDates = new Set(allLedgerEntries.map((entry) => entry.date));
    const streakDays = getLedgerStreak(recordedDates);
    if (streakDays >= 30) {
      return { tier: "thirty", streakDays, title: "30 天金色徽章", hint: "稳定记录已经成为你的个人仪式。" };
    }
    if (streakDays >= 7) {
      return { tier: "seven", streakDays, title: "7 天渐变徽章", hint: "连续记录一周，预算感会越来越清晰。" };
    }
    return { tier: "default", streakDays, title: "蓝色起步徽章", hint: "不用追求完美，留下今天的一笔就很好。" };
  }, [allLedgerEntries]);

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

  useEffect(() => {
    void refreshExchange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const exportJson = () => {
    const payload = buildBackupPayload({
      ledger: JSON.parse(serializeLedger(ledger)),
      exchange,
      lastCurrency,
      statsCurrencies: selectedStatsCurrencies,
      customCurrencies,
      theme: themeMode,
      backupReminder: readBackupReminderState(),
      settings: appSettings,
      travelState,
      travelHistory,
      pendingTravelDeletes,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = makeBackupFilename(new Date(payload.exportedAt));
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const prepareBackupImport = (payload: MoneyCountsBackupPayload, fileName: string): PreparedBackupImport => {
    const nextCustomCurrencies = normalizeStoredCustomCurrencies(payload.data.customCurrencies);
    const importedKnownCurrencies = Array.from(new Set([...DEFAULT_CURRENCIES, ...nextCustomCurrencies]));
    const currencyNormalizer = (value: unknown) => normalizeBackupCurrencyWithKnown(value, importedKnownCurrencies);
    const nextLedger = normalizeBackupLedger(payload.data.ledger, importedKnownCurrencies);
    const nextLastCurrency = currencyNormalizer(payload.data.lastCurrency) ?? "HKD";
    const nextStatsCurrencies = normalizeBackupCurrencyList(
      payload.data.statsCurrencies,
      [nextLastCurrency],
      importedKnownCurrencies,
    );
    const nextTravelHistory = normalizeStoredTravelHistory(payload.data.travelHistory, currencyNormalizer);
    const nextPendingTravelDeletes = normalizeStoredPendingTravelDeletes(payload.data.pendingTravelDeletes, currencyNormalizer);

    return {
      payload,
      ledger: nextLedger,
      exchange: normalizeBackupExchange(payload.data.exchange, importedKnownCurrencies),
      customCurrencies: nextCustomCurrencies,
      lastCurrency: nextLastCurrency,
      statsCurrencies: nextStatsCurrencies,
      theme: payload.data.theme === "dark" ? "dark" : "light",
      backupReminder: normalizeBackupReminderState(payload.data.backupReminder),
      settings: normalizeAppSettings(payload.data.settings ?? appSettings),
      travelState: normalizeStoredTravelState(payload.data.travelState, currencyNormalizer),
      travelHistory: nextTravelHistory,
      pendingTravelDeletes: nextPendingTravelDeletes,
      preview: {
        fileName,
        exportedAt: payload.exportedAt,
        incomingLedger: summarizeLedger(nextLedger),
        currentLedger: summarizeLedger(ledger),
        settingsWillOverwrite: Boolean(payload.data.settings),
        travelHistoryCount: nextTravelHistory.length,
        currentTravelHistoryCount: travelHistory.length,
      },
    };
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const payload = parseBackupPayload(parsed);
      const prepared = prepareBackupImport(payload, file.name);
      setPreparedJsonImport(prepared);
      setJsonImportMessage(`已读取 v${BACKUP_VERSION} 备份，请确认预览后再覆盖导入。`);
    } catch (error) {
      setPreparedJsonImport(null);
      setJsonImportMessage(error instanceof SyntaxError ? "JSON 格式错误，无法解析。" : error instanceof Error ? error.message : "导入文件无效。");
    } finally {
      event.target.value = "";
    }
  };

  const confirmJsonImport = () => {
    if (!preparedJsonImport) return;
    setLedger(preparedJsonImport.ledger);
    setExchange(preparedJsonImport.exchange);
    setCustomCurrencies(preparedJsonImport.customCurrencies);
    setLastCurrency(preparedJsonImport.lastCurrency);
    setDailyDefaultCurrency(preparedJsonImport.lastCurrency);
    setSelectedStatsCurrencies(preparedJsonImport.statsCurrencies);
    setThemeMode(preparedJsonImport.theme);
    setAppSettings(preparedJsonImport.settings);
    setTravelState(preparedJsonImport.travelState);
    setTravelHistory(preparedJsonImport.travelHistory);
    setPendingTravelDeletes(preparedJsonImport.pendingTravelDeletes);
    setSelectedTravelHistoryId(null);
    setTravelHistorySelectedIds([]);
    setTravelHistoryMergeMode(false);

    if (preparedJsonImport.backupReminder) {
      localStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(preparedJsonImport.backupReminder));
    } else {
      localStorage.removeItem(BACKUP_REMINDER_KEY);
    }
    setBackupReminderVisible(shouldShowBackupReminder(preparedJsonImport.backupReminder));
    setJsonImportMessage(
      `已覆盖导入 ${preparedJsonImport.preview.incomingLedger.recordCount} 条记录，旅游历史 ${preparedJsonImport.preview.travelHistoryCount} 条。`,
    );
    setPreparedJsonImport(null);
  };

  const cancelJsonImport = () => {
    setPreparedJsonImport(null);
    setJsonImportMessage("已取消 JSON 导入。");
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
    const importedEntries: Array<{ date: string; index: number; record: LocalLedgerRecord }> = [];
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
      importedEntries.push({ date, index: getEntryIndex(categoryIndex, rowIndex), record });
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
    return { imported, messages, importedEntries };
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
    const { imported, messages, importedEntries } = importNaturalLedgerRecords(naturalLedgerPreview);
    setNaturalLedgerWarnings(messages);
    setNaturalLedgerStatus(
      imported
        ? `已确认导入 ${imported} 条记录${messages.length ? `，另有 ${messages.length} 条提示。` : "。"}`
        : messages.length ? "没有记录被导入，请查看提示。" : "没有待导入记录。",
    );
    if (imported) {
      setImportMessage(`自然语言记账已导入 ${imported} 条记录。`);
      setQuickEntryStatus(`已记录 ${imported} 笔`);
      applyTravelMetaForImportedEntries(importedEntries, naturalLedgerInput);
      setNaturalLedgerPreview([]);
      setNaturalLedgerInput("");
      setCelebrationTick((tick) => tick + 1);
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
      <section className={`card stats-card stat-variant-${variant}`} data-section={`${type}-stats-card`}>
        <div className="card-heading">
          <div>
            <p className="eyebrow">{range}</p>
            <h2>{title}</h2>
          </div>
          <div className="card-heading__actions">
            <button
              type="button"
              className="stats-card__currency-btn"
              data-action={`${type}-stats-currency`}
              onClick={() => setStatsCurrencyPopup(type)}
              aria-label={`${title}统计货币`}
              title="选择统计货币"
            >
              💱
            </button>
            <button
              className="ghost-button"
              data-action={`${type}-stats-toggle`}
              onClick={() => setExpandedStats((current) => ({ ...current, [type]: !current[type] }))}
            >
              {expandedStats[type] ? "收起" : "展开"}
            </button>
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
          <Suspense fallback={<div className="chart-fallback">图表载入中…</div>}>
            <LazyPieChart summary={summary} title={title} />
          </Suspense>
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

  const detectMentionedTravelParticipantIds = (rawInput: string, participants = travelState.participants) => {
    const text = rawInput.replace(/\s+/g, "");
    const roster = participants.length ? participants : DEFAULT_TRAVEL_STATE.participants;
    const intro = text.match(/(?:和|跟|与)([^，。,.;；、在]+)(?:在|去|到|吃|喝|玩|买|花|消费|,|，|。|$)/u)?.[1] ?? text;
    const matched = roster.filter((participant) => {
      if (participant.id === "me" && !/(我|本人|自己)/.test(intro)) return false;
      const name = participant.name.trim();
      return Boolean(name && intro.includes(name));
    });
    return matched.map((participant) => participant.id);
  };

  const applyTravelMetaForImportedEntries = (
    importedEntries: Array<{ date: string; index: number; record: LocalLedgerRecord }>,
    rawInput: string,
  ) => {
    if (!travelState.active || !importedEntries.length) return;
    const participantIds = detectMentionedTravelParticipantIds(rawInput);
    if (!participantIds.length) return;
    setTravelState((current) => ({
      ...current,
      entryMeta: {
        ...current.entryMeta,
        ...Object.fromEntries(
          importedEntries.map(({ date, index, record }) => [
            `${date}:${index}`,
            {
              participantIds,
              locationLabel: current.locationLabel ?? record.note,
            },
          ]),
        ),
      },
    }));
  };

  const handleQuickExpenses = async (results: QuickExpenseResult[], rawInput: string) => {
    setQuickEntryStatus("正在整理快速输入预览...");
    setNaturalLedgerInput(rawInput);
    setIsParsingNaturalLedger(true);
    setNaturalLedgerWarnings([]);
    try {
      const result = await parseNaturalLedger(rawInput, {
        selectedDate,
        defaultCurrency: dailyDefaultCurrency,
        categories: CATEGORIES,
        currencies: allCurrencies,
      });
      const parsedRecords = result.records
        .map((record) => normalizeParsedNaturalRecord(record))
        .filter((record): record is LocalLedgerRecord => Boolean(record));
      const fallbackRecords = results.map((quickResult) => ({
        date: selectedDate,
        category: quickResult.category,
        amount: quickResult.amount,
        currency: quickResult.currency,
        note: quickResult.note,
      }));
      const records = parsedRecords.length ? parsedRecords : fallbackRecords;
      setNaturalLedgerPreview(records);
      setNaturalLedgerWarnings(result.warnings);
      setQuickEntryStatus(records.length ? `已生成 ${records.length} 笔预览，请确认后写入。` : "未生成可导入预览。");
    } catch (error) {
      const fallbackRecords = results.map((quickResult) => ({
        date: selectedDate,
        category: quickResult.category,
        amount: quickResult.amount,
        currency: quickResult.currency,
        note: quickResult.note,
      }));
      setNaturalLedgerPreview(fallbackRecords);
      setNaturalLedgerWarnings([error instanceof Error ? error.message : "本地规则解析失败，已保留草稿识别结果。"]);
      setQuickEntryStatus(fallbackRecords.length ? `已生成 ${fallbackRecords.length} 笔基础预览，请确认后写入。` : "快速输入解析失败，请稍后重试。");
    } finally {
      setIsParsingNaturalLedger(false);
    }
  };

  const clearQuickEntryStatus = useCallback(() => {
    setQuickEntryStatus("");
    setNaturalLedgerStatus("");
  }, []);

  const handleTravelNaturalSubmit = async (rawInput: string) => {
    if (!travelState.active) {
      setTravelStatus("请先开启旅游模式，再记录分账账单。");
      return;
    }
    try {
      const result = await parseNaturalLedger(rawInput, {
        selectedDate,
        defaultCurrency: travelState.destinationCurrency || dailyDefaultCurrency,
        categories: CATEGORIES,
        currencies: allCurrencies,
      });
      const records = result.records
        .map((record) => normalizeParsedNaturalRecord(record))
        .filter((record): record is LocalLedgerRecord => Boolean(record));
      if (!records.length) {
        setTravelStatus(result.warnings[0] ?? "未识别到可写入的旅游账单。");
        return;
      }
      const { imported, messages, importedEntries } = importNaturalLedgerRecords(records);
      if (!imported) {
        setTravelStatus(messages[0] ?? "旅游账单写入失败，请检查类目上限或金额格式。");
        return;
      }
      applyTravelMetaForImportedEntries(importedEntries, rawInput);
      const participantNames = detectMentionedTravelParticipantIds(rawInput)
        .map((id) => travelState.participants.find((participant) => participant.id === id)?.name ?? id)
        .join(" / ");
      setTravelStatus(
        `已写入 ${imported} 笔旅游账单${participantNames ? `，参与分摊：${participantNames}` : ""}${messages.length ? `；另有 ${messages.length} 条提示` : "。"}`,
      );
      setCelebrationTick((tick) => tick + 1);
    } catch (error) {
      setTravelStatus(`旅游自然语言解析失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const handleStatCardClick = (cardId: string) => {
    if (cardId === "theme") {
      setThemeMode((mode) => (mode === "dark" ? "light" : "dark"));
      return;
    }
    if (cardId === "currency") {
      setCurrencyModal({ type: "daily-default" });
      return;
    }
    if (cardId === "travel") {
      navigate("/travel");
    }
  };

  const todayActiveEntries = useMemo(() => {
    const items: Array<{
      index: number;
      categoryIndex: number;
      category: string;
      rowIndex: number;
      amount: string;
      currency: string;
      note: string;
      hidden?: boolean;
    }> = [];
    CATEGORIES.forEach((category, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < visibleRowCounts[categoryIndex]; rowIndex += 1) {
        const index = getEntryIndex(categoryIndex, rowIndex);
        const entry = selectedEntries[index];
        if (!entry || !hasEntryContent(entry)) continue;
        items.push({
          index,
          categoryIndex,
          category,
          rowIndex,
          amount: entry.amount,
          currency: entry.currency,
          note: entry.note,
          hidden: entry.hidden,
        });
      }
    });
    return items;
  }, [selectedEntries, visibleRowCounts]);

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
  const travelSplitSummary = useMemo(
    () => summarizeTravelSplit(travelDetails, travelState, exchange),
    [exchange, travelDetails, travelState],
  );
  const travelLocationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            travelState.locationLabel,
            ...Object.values(travelState.entryMeta).map((meta) => meta.locationLabel),
            ...travelHistory.flatMap((record) => record.details.map((detail) => detail.locationLabel)),
          ]
            .filter((value): value is string => Boolean(value && value.trim()))
            .map((value) => value.trim()),
        ),
      ).slice(0, 24),
    [travelHistory, travelState.entryMeta, travelState.locationLabel],
  );
  const travelBudgetProgress = useMemo(() => {
    const total = travelTotals.converted[travelState.targetCurrency] ?? 0;
    const activeDates = new Set(travelDetails.map((entry) => entry.date));
    const dayCount = Math.max(
      1,
      travelState.startDate
        ? Math.max(activeDates.size, Math.floor((parseDateKey(travelEndDate).getTime() - parseDateKey(travelState.startDate).getTime()) / DAY_MS) + 1)
        : activeDates.size,
    );
    const dailyLimit = travelState.budget.dailyLimit;
    const dailyBudget = dailyLimit ? dailyLimit * dayCount : null;
    const categoryProgress = CATEGORIES.map((category) => {
      const limit = travelState.budget.categoryLimits[category];
      if (!limit) return null;
      const spent = travelCategorySummary.find((item) => item.category === category)?.value ?? 0;
      return { category, limit, spent, percent: (Math.abs(spent) / limit) * 100 };
    }).filter((item): item is { category: string; limit: number; spent: number; percent: number } => Boolean(item));
    return {
      dayCount,
      dailyBudget,
      total,
      dailyPercent: dailyBudget ? (Math.abs(total) / dailyBudget) * 100 : 0,
      categoryProgress,
    };
  }, [travelCategorySummary, travelDetails, travelEndDate, travelState.budget, travelState.startDate, travelState.targetCurrency, travelTotals.converted]);

  const updateTravelParticipants = (names: string[]) => {
    setTravelState((current) => {
      const { participants, entryMeta } = reconcileTravelParticipants(current.participants, names, current.entryMeta);
      return { ...current, participants, entryMeta };
    });
  };

  const updateTravelEntryMeta = (travelKey: string, patch: Partial<{ participantIds: string[]; locationLabel: string }>) => {
    setTravelState((current) => {
      const fallbackIds = current.participants.map((participant) => participant.id);
      const currentMeta = current.entryMeta[travelKey] ?? { participantIds: fallbackIds, locationLabel: "" };
      return {
        ...current,
        entryMeta: {
          ...current.entryMeta,
          [travelKey]: {
            participantIds: patch.participantIds ?? currentMeta.participantIds,
            locationLabel: patch.locationLabel ?? currentMeta.locationLabel,
          },
        },
      };
    });
  };

  const updateTravelBudget = (patch: Partial<TravelState["budget"]>) => {
    setTravelState((current) => ({
      ...current,
      budget: {
        ...current.budget,
        ...patch,
      },
    }));
  };


  const dismissBackupReminder = (cooldownDays = 3, permanent = false) => {
    const now = Date.now();
    const nextState: BackupReminderState = {
      dismissedAt: now,
      snoozeUntil: permanent ? undefined : now + cooldownDays * DAY_MS,
      permanent,
    };
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
      participants: travelState.participants.length ? travelState.participants : DEFAULT_TRAVEL_STATE.participants,
      entryMeta: travelState.entryMeta ?? {},
      budget: travelState.budget ?? DEFAULT_TRAVEL_STATE.budget,
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

  const endTravelMode = (keepMode: "self" | "all" = "all") => {
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
        details: travelDetails.map((entry) => {
          const amount = parseAmount(entry.amount);
          const participantIds = getTravelParticipantsForEntry(entry, travelState);
          const participantNames = participantIds.map(
            (id) => travelState.participants.find((participant) => participant.id === id)?.name ?? id,
          );
          const snapshot = buildTravelExchangeSnapshot(amount, entry.currency, travelState.targetCurrency, exchange);
          return {
            date: entry.date,
            category: entry.category,
            amount: entry.amount,
            currency: entry.currency,
            note: entry.note,
            convertedAmount: snapshot.convertedAmount,
            locationLabel: travelState.entryMeta[entry.travelKey]?.locationLabel || undefined,
            participantIds,
            participantNames,
            splitShare: participantIds.length ? snapshot.convertedAmount / participantIds.length : snapshot.convertedAmount,
            exchangeSnapshot: snapshot,
          };
        }),
        participants: travelState.participants,
        splitSummary: travelSplitSummary,
        budget: travelState.budget,
        savedAt: Date.now(),
      };
      setTravelHistory((current) => [record, ...current]);
    }

    setTravelState({ ...DEFAULT_TRAVEL_STATE, participants: travelState.participants, budget: travelState.budget });
    setTravelDraftBillName("");
    setTravelDraftUseEndDate(false);
    setTravelExitModalOpen(false);
    setTravelStatus(
      `旅游模式已结束，账单「${billName}」已写入历史：${startDate} 至 ${endDate}。${keepMode === "self" ? "本地标记为仅保留本人支出口径。" : "本地保留所有人分账支出口径。"}`,
    );
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

  const syncTravelHistoryRecord = (id: string, mode: "full" | "split") => {
    const record = travelHistory.find((item) => item.id === id);
    if (!record) return;
    const label = mode === "full" ? "完整账单" : "分账账单";
    const confirmed = window.confirm(`确认将「${record.name}」的${label}标记为已同步到本地对应账户？当前版本没有远端账户系统，只会写入本地同步标记并保留导出能力。`);
    if (!confirmed) return;
    setTravelHistory((current) =>
      current.map((item) =>
        item.id === id ? { ...item, localSync: { mode, syncedAt: Date.now() } } : item,
      ),
    );
    setTravelStatus(`已本地标记同步「${record.name}」的${label}。`);
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


  const exportTravelBill = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["section", "date", "category", "amount", "currency", "converted", "targetCurrency", "location", "participants", "note"],
      ...travelCategorySummary.map((item) => [
        "category",
        "",
        item.category,
        "",
        "",
        formatMoney(item.value, travelState.targetCurrency),
        travelState.targetCurrency,
        "",
        "",
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
        travelState.entryMeta[entry.travelKey]?.locationLabel ?? "",
        getTravelParticipantsForEntry(entry, travelState)
          .map((id) => travelState.participants.find((participant) => participant.id === id)?.name ?? id)
          .join(" / "),
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
  const monthLedgerDayCount = countRecordedDates(monthEntries);
  const localTodayKey = getToday();
  const currentMonthKey = getMonthKey(localTodayKey);
  const monthElapsedDayCount =
    monthKey === currentMonthKey
      ? parseDateKey(localTodayKey).getDate()
      : monthKey < currentMonthKey
        ? getDaysInMonth(monthKey)
        : parseDateKey(selectedDate).getDate();
  const monthlyRecordProgress = calculateMonthlyRecordProgress(monthLedgerDayCount, monthElapsedDayCount);
  const weekRecordCount = countVisibleRecords(weekEntries);
  const monthRecordCount = countVisibleRecords(monthEntries);
  const todayTopSpend = (() => {
    let top = { value: 0, label: "暂无", currency: dailyDefaultCurrency };
    CATEGORIES.forEach((category, categoryIndex) => {
      for (let rowIndex = 0; rowIndex < visibleRowCounts[categoryIndex]; rowIndex += 1) {
        const index = getEntryIndex(categoryIndex, rowIndex);
        const entry = selectedEntries[index];
        if (!entry || entry.hidden) continue;
        const value = Math.abs(parseAmount(entry.amount));
        if (value > top.value) {
          top = { value, label: entry.note || category, currency: entry.currency };
        }
      }
    });
    return top;
  })();
  const rateAgeHours = Math.max(0, Math.floor((Date.now() - exchange.updatedAt) / (60 * 60 * 1000)));
  const categoriesUsedToday = CATEGORIES.filter((_, categoryIndex) =>
    Array.from({ length: visibleRowCounts[categoryIndex] }, (_, rowIndex) => {
      const index = getEntryIndex(categoryIndex, rowIndex);
      const entry = selectedEntries[index];
      return Boolean(entry && !entry.hidden && parseAmount(entry.amount) !== 0);
    }).some(Boolean),
  ).length;
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
        clickable: true,
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
        id: "top-spend",
        title: "今日最大单笔",
        value: todayTopSpend.value ? formatMoney(todayTopSpend.value, todayTopSpend.currency) : "暂无",
        hint: todayTopSpend.label,
        variant: "peach",
        effect: "pulse",
        accent: "#ffd6a5",
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
        id: "week-count",
        title: "本周记账笔数",
        value: `${weekRecordCount} 笔`,
        hint: weekTitle,
        variant: "cyan",
        effect: "float",
        accent: "#89cff0",
      },
      {
        id: "theme",
        title: "当前主题",
        value: themeMode === "dark" ? "夜间模式" : "浅色模式",
        hint: "点击卡片切换",
        variant: "night",
        effect: "spark",
        accent: "#356fd7",
        clickable: true,
      },
      {
        id: "travel",
        title: "旅游模式",
        value: travelState.active ? "旅行中" : "本地日常",
        hint: travelState.active ? `目的地 ${travelState.destinationCurrency}` : "点击进入旅游页",
        variant: "lime",
        effect: "orbit",
        accent: "#90ded1",
        clickable: true,
      },
      {
        id: "weekly-win",
        title: "省钱小成就",
        value: weeklyAchievement.enoughData
          ? weeklyAchievement.savedAmount > 0
            ? formatMoney(weeklyAchievement.savedAmount, budgetCurrency)
            : "节奏稳定"
          : "待解锁",
        hint: weeklyAchievement.enoughData ? weeklyAchievement.categoryMessage : "再记录几天就能对比上周",
        variant: "gold",
        effect: "spark",
        accent: "#e6c46c",
      },
      {
        id: "spending-insight",
        title: "消费洞察",
        value: spendingInsight.enoughData ? "已生成" : "积累中",
        hint: spendingInsight.enoughData ? spendingInsight.message : "近 30 天数据会慢慢变准",
        variant: "aqua",
        effect: "float",
        accent: "#74e8d8",
      },
      {
        id: "streak-badge",
        title: "里程碑勋章",
        value: ledgerBadge.title,
        hint: `连续记录 ${ledgerBadge.streakDays} 天`,
        variant: "peach",
        effect: "pulse",
        accent: "#ffd6a5",
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
        title: "本月已记录",
        value: `${monthlyRecordProgress}%`,
        hint: `${monthLedgerDayCount}/${monthElapsedDayCount} 天已有记录`,
        variant: "cyan",
        effect: "flip",
        accent: "#89cff0",
        progress: monthlyRecordProgress,
      },
      {
        id: "month-count",
        title: "本月总笔数",
        value: `${monthRecordCount} 笔`,
        hint: `${monthKey} 累计`,
        variant: "blue",
        effect: "tilt",
        accent: "#5b8cff",
      },
      {
        id: "rate-age",
        title: "汇率缓存",
        value: rateAgeHours < 24 ? `${rateAgeHours}h 前` : "超过 24h",
        hint: rateAgeHours < 24 ? "数据还算新鲜" : "建议手动刷新",
        variant: "slate",
        effect: "float",
        accent: "#94a3b8",
      },
      {
        id: "categories-used",
        title: "今日分类数",
        value: `${categoriesUsedToday} 类`,
        hint: categoriesUsedToday ? "分类分布挺丰富" : "还没开始分类",
        variant: "violet",
        effect: "spark",
        accent: "#b4a7d6",
      },
    ],
    [
      categoriesUsedToday,
      customCurrencies,
      dailyDefaultCurrency,
      dayTotals,
      budgetCurrency,
      exchange,
      ledgerBadge,
      monthKey,
      monthElapsedDayCount,
      monthLedgerDayCount,
      monthlyRecordProgress,
      monthRecordCount,
      rateAgeHours,
      targetRateCurrency,
      themeMode,
      todayFortune,
      todayRecordCount,
      todayTopSpend,
      travelState.active,
      travelState.destinationCurrency,
      spendingInsight,
      weeklyAchievement,
      weekRecordCount,
      weekTitle,
      weekTopCategory,
    ],
  );
  const displayedFunCards = useMemo(
    () =>
      pickStableItems(
        appSettings.homeSections.travelEntry ? funDataCards : funDataCards.filter((card) => card.id !== "travel"),
        `${selectedDate}:${funCardShuffleSalt}`,
        3,
      ),
    [appSettings.homeSections.travelEntry, funCardShuffleSalt, funDataCards, selectedDate],
  );

  const renderHomeSection = (key: HomeSectionKey) => {
    switch (key) {
      case "quickEntry":
        return (
          <div key={key} className="home-section-slot home-section-slot--entry" data-section="quick-entry-slot">
            <NaturalLanguageInput
              defaultCurrency={isPrimaryCurrency(dailyDefaultCurrency) ? (dailyDefaultCurrency as "CNY" | "HKD") : "HKD"}
              categories={CATEGORIES}
              currencies={allCurrencies}
              onDefaultCurrencyChange={(currency) => switchDailyDefaultCurrency(currency)}
              onSubmit={handleQuickExpenses}
              onConfirm={confirmNaturalLedgerImport}
              onClearStatus={clearQuickEntryStatus}
              onPreviewChange={updateNaturalLedgerPreviewRecord}
              onPreviewDelete={deleteNaturalLedgerPreviewRecord}
              onPreviewAdd={addNaturalLedgerPreviewRecord}
              previewRecords={naturalLedgerPreview}
              previewIssues={naturalLedgerPreviewIssues}
              warnings={naturalLedgerWarnings}
              canConfirm={canImportNaturalLedgerPreview}
              isParsing={isParsingNaturalLedger}
              resetSignal={celebrationTick}
              statusMessage={quickEntryStatus || naturalLedgerStatus}
            />
          </div>
        );
      case "heroCards":
        return (
          <HeroSection
            key={key}
            selectedDate={selectedDate}
            weekdayLabel={formatWeekday(selectedDate)}
            statCards={displayedFunCards}
            onOpenDatePicker={() => setDatePickerOpen(true)}
            onPrevDay={() => moveSelectedDate(-1)}
            onToday={jumpToToday}
            onNextDay={() => moveSelectedDate(1)}
            onShuffleCards={() => setFunCardShuffleSalt((salt) => salt + 1)}
            onStatCardClick={handleStatCardClick}
            showStats={appSettings.homeSections.heroCards}
          />
        );
      case "budgetOverview":
        return (
          <FeatureBlock key={key} id="budget" eyebrow="Budget" title="预算概览" subtitle="开启后可查看月预算、分类预算与日均可花" variant="mint">
            <BudgetOverview
              settings={appSettings.budget}
              currency={budgetCurrency}
              monthKey={monthKey}
              monthlySpent={monthlyBudgetSpent}
              categoryProgress={categoryBudgetProgress}
              remainingDays={getRemainingDaysForBudget(monthKey)}
              formatMoney={formatMoney}
              onOpenSettings={() => navigate("/settings")}
            />
          </FeatureBlock>
        );
      case "todayDetails":
        return (
          <FeatureBlock
            key={key}
            id="today"
            eyebrow="Today"
            title={`${selectedDate} 今日明细`}
            subtitle="直接在表格中编辑金额、货币与备注"
            variant="mint"
          >
            <TodayEntriesList
              entries={todayActiveEntries}
              currencies={allCurrencies}
              formatMoney={formatMoney}
              parseAmount={parseAmount}
              onAmountChange={handleAmountChange}
              onNoteChange={(index, value) => updateEntry(index, { note: value })}
              onCurrencyChange={(index, currency) => updateEntry(index, { currency })}
              onDelete={deleteCategoryRecord}
            />
            <button type="button" className="secondary-button today-open-manual" data-action="open-manual-ledger" onClick={() => setSettingsModalOpen(true)}>
              打开完整记账表格
            </button>
          </FeatureBlock>
        );
      case "dayTotals":
        return (
          <FeatureBlock key={key} id="totals" eyebrow="Day Totals" title="当日汇总" subtitle="默认分币种展示，可切换单币种合并" variant="sky">
            <div className="feature-block__header-row">
              <p className="muted">{dailySummaryMode === "split" ? "按原币种分开展示" : `合并为 ${dailyDefaultCurrency} 统计口径`}</p>
              <SummaryModeToggle mode={dailySummaryMode} onChange={setDailySummaryMode} />
            </div>
            <div className="totals-grid totals-grid--hero">
              {dailySummaryMode === "split" ? (
                daySplitCurrencies.length ? (
                  daySplitCurrencies.map((currency) => (
                    <div key={currency} className="total-pill">
                      <span>{getCurrencyMeta(currency).shortName}</span>
                      <strong>{formatMoney(dayTotals.native[currency], currency)}</strong>
                    </div>
                  ))
                ) : (
                  <p className="muted">今日暂无支出</p>
                )
              ) : (
                <div className="total-pill">
                  <span>{dailyDefaultCurrency} 合并口径</span>
                  <strong>{formatMoney(dayTotals.converted[dailyDefaultCurrency], dailyDefaultCurrency)}</strong>
                </div>
              )}
            </div>
          </FeatureBlock>
        );
      case "weekStats":
        return (
          <div key={key} className="stats-grid" id="week" data-section="week-stats">
            {renderStatsCard(
              weekTitle,
              "自然周（周一至周日）",
              weekTotals,
              weekCategorySummary,
              "week",
              (statVariant + 1) % 3,
            )}
          </div>
        );
      case "monthStats":
        return (
          <div key={key} className="stats-grid" id="month" data-section="month-stats">
            {renderStatsCard(
              "本月汇总",
              monthKey,
              monthTotals,
              monthCategorySummary,
              "month",
              (statVariant + 2) % 3,
            )}
          </div>
        );
      case "tools":
        return (
          <FeatureBlock key={key} id="tools" eyebrow="Year Trend" title="全年趋势图表" subtitle="保留趋势、导入导出，并把预算/汇率作为本屏可选卡片" variant="neutral">
            <section className="card trend-card" data-section="year-trend">
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
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <Suspense fallback={<div className="chart-fallback chart-fallback--wide">趋势图载入中…</div>}>
                <LazyTrendChart rows={trendRows} min={trendMin} max={trendMax} />
              </Suspense>
              <div className="trend-list">
                {trendRows.map((row) => (
                  <span key={row.month}>
                    {row.month}: {formatMoney(row.value, trendCurrency)}
                  </span>
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
                <button type="button" data-action="csv-export" onClick={exportCsv}>导出 CSV</button>
                <button type="button" className="secondary-button" data-action="csv-import-pick" onClick={() => fileInputRef.current?.click()}>
                  导入 CSV
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={importCsv} />
              </div>
              <div className="danger-zone" aria-label="危险数据操作">
                <button type="button" className="danger-button" data-action="clear-current-day" onClick={clearCurrentDay}>
                  清空当日数据
                </button>
                <button type="button" className="danger-button" data-action="clear-current-month" onClick={clearCurrentMonth}>
                  清空当月数据
                </button>
              </div>
            </section>
            <div className="year-support-grid" data-section="year-support-cards">
              {appSettings.budget.enabled ? renderHomeSection("budgetOverview") : null}
            </div>
          </FeatureBlock>
        );
      case "footer":
        return <SiteFooter key={key} />;
      case "travelEntry":
        return null;
      default:
        return null;
    }
  };

  const navTravelAccent = location.pathname === "/travel" || travelState.active;

  return (
    <>
      <div className="global-nav-host">
        <ScrollNav settings={appSettings} travelAccent={navTravelAccent} />
      </div>
      <MobileScrollNav settings={appSettings} travelAccent={navTravelAccent} />
      <Routes>
        <Route
          path="/"
          element={
            <div className="app-shell home-shell journal-scroll" ref={appRootRef}>
              <header className="home-screen home-screen--hero" id="hero-screen" data-section="screen-hero">
                  {renderHomeSection("heroCards")}
                  {renderHomeSection("quickEntry")}
              </header>
              <main className="app-main home-main" data-section="home-main">
                <section className="home-screen" id="screen-today" data-section="screen-today">
                  {renderHomeSection("todayDetails")}
                </section>
                <section className="home-screen" id="screen-day" data-section="screen-day">
                  {renderHomeSection("dayTotals")}
                </section>
                <section className="home-screen" id="screen-week" data-section="screen-week">
                  {appSettings.homeSections.weekStats ? renderHomeSection("weekStats") : null}
                </section>
                <section className="home-screen" id="screen-month" data-section="screen-month">
                  {appSettings.homeSections.monthStats ? renderHomeSection("monthStats") : null}
                </section>
                <section className="home-screen home-screen--year" id="screen-year" data-section="screen-year">
                  {appSettings.homeSections.tools ? renderHomeSection("tools") : null}
                </section>
              </main>
              <div className="home-screen home-screen--footer" id="screen-footer" data-section="screen-footer">
                  {renderHomeSection("footer")}
              </div>
            </div>
          }
        />
        <Route
          path="/search"
          element={
            <SearchPage
              records={searchRecords}
              categories={CATEGORIES}
              currency={budgetCurrency}
              formatMoney={formatMoney}
              onSelectDate={(date) => {
                commitDateChange(date);
                navigate("/#today");
              }}
            />
          }
        />
        <Route
          path="/travel"
          element={
            <TravelPage
              travelState={travelState}
              travelHistory={travelHistory}
              travelHistoryRailOpen={travelHistoryRailOpen}
              travelHistoryMergeMode={travelHistoryMergeMode}
              travelHistorySelectedIds={travelHistorySelectedIds}
              travelHistoryEditingId={travelHistoryEditingId}
              travelHistoryEditingName={travelHistoryEditingName}
              travelDraftBillName={travelDraftBillName}
              travelDraftStartDate={travelDraftStartDate}
              travelDraftUseEndDate={travelDraftUseEndDate}
              travelDraftEndDate={travelDraftEndDate}
              travelStatus={travelStatus}
              travelRangeLabel={travelRangeLabel}
              travelDetails={travelDetails}
              travelTotals={travelTotals}
              travelCategorySummary={travelCategorySummary}
              travelSplitSummary={travelSplitSummary}
              travelLocationOptions={travelLocationOptions}
              travelBudgetProgress={travelBudgetProgress}
              pendingTravelDeletes={pendingTravelDeletes}
              deleteToastTick={deleteToastTick}
              selectedTravelHistoryId={selectedTravelHistoryId}
              travelMergeModalOpen={travelMergeModalOpen}
              allCurrencies={allCurrencies}
              exchange={exchange}
              modalRootRef={modalRootRef}
              formatMoney={formatMoney}
              parseAmount={parseAmount}
              convert={convert}
              getCurrencyMeta={getCurrencyMeta}
              buildFallbackBillName={buildFallbackBillName}
              PieChart={LazyPieChart}
              onEnableTravel={enableTravelMode}
              onEndTravel={() => setTravelExitModalOpen(true)}
              onExportBill={exportTravelBill}
              onTravelNaturalSubmit={handleTravelNaturalSubmit}
              setTravelDraftBillName={setTravelDraftBillName}
              setTravelDraftStartDate={setTravelDraftStartDate}
              setTravelDraftUseEndDate={setTravelDraftUseEndDate}
              setTravelDraftEndDate={setTravelDraftEndDate}
              setTravelState={setTravelState}
              updateTravelParticipants={updateTravelParticipants}
              updateTravelEntryMeta={updateTravelEntryMeta}
              updateTravelBudget={updateTravelBudget}
              switchDailyDefaultCurrency={switchDailyDefaultCurrency}
              setTravelHistoryRailOpen={setTravelHistoryRailOpen}
              setSelectedTravelHistoryId={setSelectedTravelHistoryId}
              setTravelHistoryMergeMode={setTravelHistoryMergeMode}
              setTravelHistorySelectedIds={setTravelHistorySelectedIds}
              setTravelMergeModalOpen={setTravelMergeModalOpen}
              setTravelHistoryEditingId={setTravelHistoryEditingId}
              setTravelHistoryEditingName={setTravelHistoryEditingName}
              saveTravelHistoryRename={saveTravelHistoryRename}
              deleteTravelHistoryRecord={deleteTravelHistoryRecord}
              syncTravelHistoryRecord={syncTravelHistoryRecord}
              undoTravelHistoryDelete={undoTravelHistoryDelete}
              confirmTravelHistoryMerge={confirmTravelHistoryMerge}
              closeTravelHistoryModal={closeTravelHistoryModal}
              PENDING_DELETE_TTL_MS={PENDING_DELETE_TTL_MS}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              settings={appSettings}
              categories={CATEGORIES}
              currencies={allCurrencies}
              baseCurrency={dailyDefaultCurrency}
              exchangeSource={exchange.source}
              exchangeUpdatedAt={exchange.updatedAt}
              exchangeRows={exchangeRows}
              rateStatus={rateStatus}
              onRefreshExchange={() => void refreshExchange()}
              backupReminderLabel={backupReminderVisible ? "当前会显示提醒" : "已暂缓提醒"}
              importMessage={jsonImportMessage}
              importPreview={preparedJsonImport?.preview ?? null}
              jsonInputRef={jsonInputRef}
              onSettingsChange={setAppSettings}
              getCurrencyLabel={(currency) => getCurrencyMeta(currency).shortName}
              onExportJson={exportJson}
              onPickJson={() => jsonInputRef.current?.click()}
              onJsonFileChange={importJson}
              onConfirmJsonImport={confirmJsonImport}
              onCancelJsonImport={cancelJsonImport}
              onSnoozeBackupReminder={dismissBackupReminder}
            />
          }
        />
      </Routes>

      <FloatingActions
        themeMode={themeMode}
        onToggleTheme={() => setThemeMode((mode) => (mode === "dark" ? "light" : "dark"))}
        onPrevDay={() => moveSelectedDate(-1)}
        onToday={jumpToToday}
        onNextDay={() => moveSelectedDate(1)}
      />

      {celebrationTick > 0 && (
        <div ref={confettiLayerRef} className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 96 }, (_, index) => {
            const palette = ["#ff8a3d", "#ffd166", "#06d6a0", "#4cc9f0", "#f72585", "#b5179e", "#7209b7"];
            return (
              <span
                key={`${celebrationTick}-${index}`}
                className="confetti-piece"
                style={{
                  left: `${(index * 13.7 + (index % 5) * 2.4) % 100}%`,
                  backgroundColor: palette[index % palette.length],
                  width: `${8 + (index % 7)}px`,
                  height: `${12 + (index % 11)}px`,
                }}
              />
            );
          })}
        </div>
      )}

      <StatsCurrencyPicker
        open={statsCurrencyPopup !== null}
        currencies={allCurrencies}
        selected={safeDisplayStatsCurrencies}
        onToggle={toggleStatsCurrency}
        onClose={() => setStatsCurrencyPopup(null)}
        getLabel={(currency) => getCurrencyMeta(currency).shortName}
      />

      <SettingsModal
        open={settingsModalOpen}
        title={`${selectedDate} 记账明细`}
        subtitle="手动选择分类、金额、货币与备注"
        onClose={() => setSettingsModalOpen(false)}
      >
        <div className="settings-modal-stack">
          <div className="settings-modal-toolbar">
            <div className="daily-default-controls">
              <span className="control-label">今日默认货币</span>
              <div className="currency-switch" data-selected={isPrimaryCurrency(dailyDefaultCurrency) ? dailyDefaultCurrency : "OTHERS"} role="group">
                {PRIMARY_CURRENCIES.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    className={dailyDefaultCurrency === currency ? "currency-switch-option active" : "currency-switch-option"}
                    onClick={() => switchDailyDefaultCurrency(currency)}
                  >
                    {currency}
                  </button>
                ))}
                <button type="button" className="currency-switch-option" onClick={() => setCurrencyModal({ type: "daily-default" })}>
                  Others
                </button>
              </div>
            </div>
          </div>
          <div className={`ledger-table-shell ledger-table-shell--modal stat-variant-${statVariant}`}>
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
                      const hiddenActionLabel = entry.hidden ? "取消隐藏" : "隐藏记录";
                      const canAdd = visibleRowCounts[categoryIndex] < MAX_RECORDS_PER_CATEGORY;
                      return (
                        <tr key={`${category}-${rowIndex}`} className={entry.hidden ? "hidden-entry-row" : undefined}>
                          {rowIndex === 0 && (
                            <th rowSpan={currentRowCount} className="category-cell">
                              <div className="category-cell-inner">
                                <span>{category}</span>
                                <button
                                  type="button"
                                  className="add-record-button add-record-button--inline"
                                  data-action="manual-ledger-add-record"
                                  onClick={() => addCategoryRecord(categoryIndex)}
                                  disabled={!canAdd}
                                  aria-label={canAdd ? `添加${category}记录` : `${category}已达上限`}
                                >
                                  +
                                </button>
                              </div>
                            </th>
                          )}
                          <td className="slot-cell"><span>#{rowIndex + 1}</span></td>
                          <td>
                            <input data-date={selectedDate} data-index={index} data-field="amount" inputMode="decimal"
                              placeholder="0.00" value={entry.amount}
                              onChange={(event) => handleAmountChange(index, event.target.value)}
                              onKeyDown={(event) => handleInputKeyDown(event, categoryIndex, rowIndex, "amount")}
                            />
                          </td>
                          <td>
                            <button type="button" className="currency-select-button" data-action="manual-ledger-currency" data-date={selectedDate} data-index={index}
                              onClick={() => setCurrencyModal({ type: "entry", index, category, rowIndex })}
                            >
                              <span>{entry.currency}</span>
                            </button>
                          </td>
                          <td>
                            <input data-date={selectedDate} data-index={index} data-field="note" placeholder="备注" value={entry.note}
                              onChange={(event) => updateEntry(index, { note: event.target.value })}
                              onKeyDown={(event) => handleInputKeyDown(event, categoryIndex, rowIndex, "note")}
                            />
                          </td>
                          <td className="record-actions">
                            <div className="record-actions-inner">
                              <button type="button" className={entry.hidden ? "hide-record-button active" : "hide-record-button"}
                                data-action="manual-ledger-toggle-hidden"
                                onClick={() => toggleEntryHidden(index)} aria-label={hiddenActionLabel}
                              >{entry.hidden ? "◌" : "○"}</button>
                              <button type="button" className="delete-record-button" title={recordActionLabel}
                                data-action="manual-ledger-delete-record"
                                onClick={() => deleteCategoryRecord(categoryIndex, rowIndex)}>×</button>
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
          <div className="keyboard-hints">
            <span><kbd>Enter</kbd> 添加记录</span>
            <span><kbd>Tab</kbd> 下一类目</span>
            <span><kbd>↑</kbd><kbd>↓</kbd> 上下行</span>
            <span><kbd>←</kbd><kbd>→</kbd> 左右字段</span>
          </div>
          {shortcutFeedback && <p className="shortcut-feedback" role="status">{shortcutFeedback}</p>}
        </div>
      </SettingsModal>

      {backupReminderVisible && (
        <aside className="backup-reminder" role="status" aria-live="polite">
          <p>建议定期导出完整 JSON 备份。数据保存在浏览器 LocalStorage 中，清理缓存或换设备后可能丢失。</p>
          <div className="backup-reminder-actions">
              <button type="button" data-action="backup-reminder-export-json" onClick={exportJson}>立即导出 JSON</button>
            <button type="button" className="ghost-button" onClick={() => dismissBackupReminder(1)}>
              明天提醒
            </button>
            <button type="button" className="secondary-button" onClick={() => dismissBackupReminder(3)}>
              3 天内不提醒
            </button>
          </div>
        </aside>
      )}

      {travelExitModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setTravelExitModalOpen(false)} ref={modalRootRef}>
          <section
            className="modal-card travel-exit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="travel-exit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Close Travel Mode</p>
                <h2 id="travel-exit-title">结束旅游模式前选择保留口径</h2>
                <p className="muted">当前版本没有独立远端账户系统，选择会写入旅游历史并在本地记录本次收尾口径。</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setTravelExitModalOpen(false)}>
                取消
              </button>
            </div>
            <div className="travel-exit-actions">
              <button type="button" onClick={() => endTravelMode("self")}>
                仅保留本人支出
              </button>
              <button type="button" className="secondary-button" onClick={() => endTravelMode("all")}>
                保留所有人分账支出
              </button>
            </div>
          </section>
        </div>
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

    </>
  );
}

export default App;
