export const APP_SETTINGS_KEY = "monthly-smart-ledger:settings";

export const HOME_SECTION_LABELS = {
  heroCards: "趣味小卡片",
  budgetOverview: "预算概览",
  quickEntry: "自然语言记账",
  todayDetails: "记账明细",
  dayTotals: "日统计",
  weekStats: "本周统计",
  monthStats: "本月汇总",
  tools: "工具与趋势",
  footer: "页脚",
  travelEntry: "旅游入口",
} as const;

/** Legacy home keys kept for import/order normalization but no longer shown on home. */
export const MIGRATED_HOME_SECTIONS = ["exchangeRates"] as const;
export type MigratedHomeSectionKey = (typeof MIGRATED_HOME_SECTIONS)[number];

export type HomeSectionKey = keyof typeof HOME_SECTION_LABELS;

export type BudgetSettings = {
  enabled: boolean;
  currency: string | null;
  monthlyLimit: number | null;
  categoryLimits: Record<string, number>;
};

export type LegacyHomeSectionKey = "exchangeRates";

export type AppSettings = {
  homeSections: Record<HomeSectionKey, boolean> & Partial<Record<LegacyHomeSectionKey, boolean>>;
  homeSectionOrder: Array<HomeSectionKey | LegacyHomeSectionKey>;
  budget: BudgetSettings;
};

export const HOME_SECTION_DEFAULT_ORDER = [
  "quickEntry",
  "heroCards",
  "budgetOverview",
  "todayDetails",
  "dayTotals",
  "weekStats",
  "monthStats",
  "tools",
  "footer",
  "travelEntry",
] as const satisfies readonly HomeSectionKey[];

export const PINNED_HOME_SECTIONS = ["quickEntry"] as const satisfies readonly HomeSectionKey[];

/** Only these four blocks may be hidden via settings toggles. */
export const TOGGLEABLE_HOME_SECTIONS = ["heroCards", "tools", "weekStats", "monthStats"] as const satisfies readonly HomeSectionKey[];

/** Always visible on home; toggles disabled in settings. */
export const LOCKED_HOME_SECTIONS = [
  "quickEntry",
  "budgetOverview",
  "todayDetails",
  "dayTotals",
  "footer",
  "travelEntry",
] as const satisfies readonly HomeSectionKey[];

export const isToggleableHomeSection = (key: HomeSectionKey): key is (typeof TOGGLEABLE_HOME_SECTIONS)[number] =>
  TOGGLEABLE_HOME_SECTIONS.includes(key as (typeof TOGGLEABLE_HOME_SECTIONS)[number]);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  homeSections: {
    heroCards: false,
    budgetOverview: true,
    quickEntry: true,
    todayDetails: true,
    dayTotals: true,
    weekStats: true,
    monthStats: true,
    tools: true,
    footer: true,
    travelEntry: true,
  },
  homeSectionOrder: [...HOME_SECTION_DEFAULT_ORDER],
  budget: {
    enabled: false,
    currency: null,
    monthlyLimit: null,
    categoryLimits: {},
  },
};

export const isMigratedHomeSection = (key: string): key is MigratedHomeSectionKey =>
  MIGRATED_HOME_SECTIONS.includes(key as MigratedHomeSectionKey);

export const normalizeHomeSectionOrder = (value: unknown): HomeSectionKey[] => {
  const known = new Set(Object.keys(DEFAULT_APP_SETTINGS.homeSections) as HomeSectionKey[]);
  const seen = new Set<HomeSectionKey>();
  const raw = Array.isArray(value) ? value : [];
  const movable = raw
    .filter((item): item is HomeSectionKey => typeof item === "string" && known.has(item as HomeSectionKey))
    .filter((key) => !isMigratedHomeSection(key))
    .filter((key) => {
      if (PINNED_HOME_SECTIONS.includes(key as (typeof PINNED_HOME_SECTIONS)[number]) || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  const missing = HOME_SECTION_DEFAULT_ORDER.filter(
    (key) => !PINNED_HOME_SECTIONS.includes(key as (typeof PINNED_HOME_SECTIONS)[number]) && !seen.has(key),
  );
  return [...PINNED_HOME_SECTIONS, ...movable, ...missing];
};

const normalizeBudgetAmount = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeAppSettings = (value: unknown): AppSettings => {
  const source = value && typeof value === "object" ? value as Partial<AppSettings> : {};
  const rawSections =
    source.homeSections && typeof source.homeSections === "object"
      ? source.homeSections as Partial<Record<HomeSectionKey, unknown>>
      : {};
  const rawBudget =
    source.budget && typeof source.budget === "object"
      ? source.budget as Partial<BudgetSettings>
      : {};
  const rawCategoryLimits =
    rawBudget.categoryLimits && typeof rawBudget.categoryLimits === "object"
      ? rawBudget.categoryLimits as Record<string, unknown>
      : {};

  const homeSections = Object.fromEntries(
    (Object.keys(DEFAULT_APP_SETTINGS.homeSections) as HomeSectionKey[]).map((key) => [
      key,
      LOCKED_HOME_SECTIONS.includes(key as (typeof LOCKED_HOME_SECTIONS)[number])
        ? true
        : typeof rawSections[key] === "boolean"
          ? rawSections[key]
          : DEFAULT_APP_SETTINGS.homeSections[key],
    ]),
  ) as Record<HomeSectionKey, boolean>;

  const categoryLimits = Object.fromEntries(
    Object.entries(rawCategoryLimits)
      .map(([category, value]) => [category, normalizeBudgetAmount(value)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] !== null),
  );

  return {
    homeSections,
    homeSectionOrder: normalizeHomeSectionOrder(source.homeSectionOrder),
    budget: {
      enabled: rawBudget.enabled === true,
      currency: typeof rawBudget.currency === "string" && rawBudget.currency.trim()
        ? rawBudget.currency.trim().toUpperCase()
        : DEFAULT_APP_SETTINGS.budget.currency,
      monthlyLimit: normalizeBudgetAmount(rawBudget.monthlyLimit),
      categoryLimits,
    },
  };
};

export const readAppSettings = (): AppSettings => {
  try {
    return normalizeAppSettings(JSON.parse(localStorage.getItem(APP_SETTINGS_KEY) ?? "null"));
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(normalizeAppSettings(settings)));
};
