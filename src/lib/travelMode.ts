export type TravelState = {
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  plannedEndDate: string | null;
  destinationCurrency: string;
  targetCurrency: string;
  billName: string | null;
  locationLabel: string | null;
  participants: TravelParticipant[];
  entryMeta: Record<string, TravelEntryMeta>;
  budget: TravelBudgetSettings;
};

export type TravelParticipant = {
  id: string;
  name: string;
};

export type TravelEntryMeta = {
  participantIds: string[];
  locationLabel: string;
};

export type TravelBudgetSettings = {
  dailyLimit: number | null;
  categoryLimits: Record<string, number>;
};

export type TravelExchangeSnapshot = {
  from: string;
  to: string;
  rate: number;
  source: string;
  updatedAt: number;
  convertedAmount: number;
};

export type TravelHistoryDetail = {
  date: string;
  category: string;
  amount: string;
  currency: string;
  note: string;
  convertedAmount: number;
  locationLabel?: string;
  participantIds?: string[];
  participantNames?: string[];
  splitShare?: number;
  exchangeSnapshot?: TravelExchangeSnapshot;
};

export type TravelHistoryCategory = {
  category: string;
  value: number;
  percent: number;
};

export type TravelHistoryRecord = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  destinationCurrency: string;
  targetCurrency: string;
  totalAmount: number;
  entryCount: number;
  categorySummary: TravelHistoryCategory[];
  details: TravelHistoryDetail[];
  participants?: TravelParticipant[];
  splitSummary?: TravelSplitSummary[];
  budget?: TravelBudgetSettings;
  localSync?: {
    mode: "full" | "split";
    syncedAt: number;
  };
  savedAt: number;
  mergedFrom?: string[];
};

export type TravelSplitSummary = {
  participantId: string;
  name: string;
  owed: number;
};

export type TravelGeoResult = {
  destinationCurrency: string;
  locationLabel: string;
  billName: string;
  countryName?: string;
};

export const TRAVEL_KEY = "monthly-smart-ledger:travel";
export const TRAVEL_HISTORY_KEY = "monthly-smart-ledger:travel-history";
export const TRAVEL_HISTORY_PENDING_DELETE_KEY = "monthly-smart-ledger:travel-history-pending-delete";
export const PENDING_DELETE_TTL_MS = 10_000;

export type PendingTravelHistoryDelete = {
  record: TravelHistoryRecord;
  deletedAt: number;
};

export const DEFAULT_TRAVEL_STATE: TravelState = {
  active: false,
  startDate: null,
  endDate: null,
  plannedEndDate: null,
  destinationCurrency: "HKD",
  targetCurrency: "CNY",
  billName: null,
  locationLabel: null,
  participants: [
    { id: "person-a", name: "A" },
    { id: "person-b", name: "B" },
    { id: "person-c", name: "C" },
  ],
  entryMeta: {},
  budget: {
    dailyLimit: null,
    categoryLimits: {},
  },
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

export const normalizeCurrencyCode = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const buildFallbackBillName = (destinationCurrency?: string) =>
  destinationCurrency ? `${destinationCurrency}之旅` : "我的旅游账单";

export const buildBillNameFromLocation = (locationLabel: string | null | undefined, destinationCurrency?: string) => {
  const label = locationLabel?.trim();
  if (label) return `${label}的旅游账单`;
  return buildFallbackBillName(destinationCurrency);
};

export const buildLegacyHistoryName = (record: Pick<TravelHistoryRecord, "startDate" | "destinationCurrency">) =>
  `${record.destinationCurrency}之旅 · ${record.startDate}`;

const normalizePositiveAmount = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeTravelParticipants = (value: unknown): TravelParticipant[] => {
  const participants = Array.isArray(value)
    ? value
        .map((item, index) => {
          if (!item || typeof item !== "object") return null;
          const participant = item as Partial<TravelParticipant>;
          const name = typeof participant.name === "string" ? participant.name.trim() : "";
          if (!name) return null;
          return {
            id: typeof participant.id === "string" && participant.id.trim()
              ? participant.id.trim()
              : `person-${index + 1}`,
            name,
          };
        })
        .filter((item): item is TravelParticipant => Boolean(item))
    : [];
  return participants.length ? participants : [...DEFAULT_TRAVEL_STATE.participants];
};

export const reconcileTravelParticipants = (
  currentParticipants: TravelParticipant[],
  names: string[],
  currentEntryMeta: Record<string, TravelEntryMeta>,
) => {
  const participants = names
    .map((name, index) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      return {
        id: currentParticipants[index]?.id ?? `person-${index + 1}`,
        name: trimmed,
      };
    })
    .filter((participant): participant is TravelParticipant => Boolean(participant));
  const nextParticipants = participants.length ? participants : [...DEFAULT_TRAVEL_STATE.participants];
  const allowed = new Set(nextParticipants.map((participant) => participant.id));
  const fallbackIds = nextParticipants.map((participant) => participant.id);
  const entryMeta = Object.fromEntries(
    Object.entries(currentEntryMeta).map(([key, meta]) => {
      const participantIds = meta.participantIds.filter((id) => allowed.has(id));
      return [
        key,
        {
          ...meta,
          participantIds: participantIds.length ? participantIds : fallbackIds,
        },
      ] as const;
    }),
  );

  return { participants: nextParticipants, entryMeta };
};

export const normalizeTravelBudgetSettings = (value: unknown): TravelBudgetSettings => {
  const source = value && typeof value === "object" ? value as Partial<TravelBudgetSettings> : {};
  const rawCategoryLimits =
    source.categoryLimits && typeof source.categoryLimits === "object"
      ? source.categoryLimits as Record<string, unknown>
      : {};
  return {
    dailyLimit: normalizePositiveAmount(source.dailyLimit),
    categoryLimits: Object.fromEntries(
      Object.entries(rawCategoryLimits)
        .map(([category, amount]) => [category, normalizePositiveAmount(amount)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null),
    ),
  };
};

export const normalizeTravelEntryMeta = (value: unknown, participants: TravelParticipant[]): Record<string, TravelEntryMeta> => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const participantIds = new Set(participants.map((item) => item.id));
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, raw]) => {
        if (!raw || typeof raw !== "object") return null;
        const meta = raw as Partial<TravelEntryMeta>;
        const selectedIds = Array.isArray(meta.participantIds)
          ? meta.participantIds.filter((id): id is string => typeof id === "string" && participantIds.has(id))
          : [];
        return [
          key,
          {
            participantIds: selectedIds.length ? selectedIds : participants.map((item) => item.id),
            locationLabel: typeof meta.locationLabel === "string" ? meta.locationLabel.trim() : "",
          },
        ] as const;
      })
      .filter((entry): entry is readonly [string, TravelEntryMeta] => Boolean(entry)),
  );
};

export const summarizeHistoryCategories = (
  details: TravelHistoryDetail[],
  categories: readonly string[],
): TravelHistoryCategory[] => {
  const totals = new Map<string, number>();
  for (const entry of details) {
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + Math.abs(entry.convertedAmount));
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
  return categories
    .map((category) => ({
      category,
      value: totals.get(category) ?? 0,
      percent: total ? ((totals.get(category) ?? 0) / total) * 100 : 0,
    }))
    .filter((item) => item.value !== 0);
};

export type CurrencyDistributionItem = {
  currency: string;
  count: number;
  nativeTotal: number;
  convertedTotal: number;
  percent: number;
  color: string;
};

export const summarizeCurrencyDistribution = (
  details: TravelHistoryDetail[],
  targetCurrency: string,
): CurrencyDistributionItem[] => {
  const buckets = new Map<string, { count: number; nativeTotal: number; convertedTotal: number }>();
  for (const entry of details) {
    const native = Math.abs(Number.parseFloat(entry.amount) || 0);
    const converted = Math.abs(entry.convertedAmount);
    const current = buckets.get(entry.currency) ?? { count: 0, nativeTotal: 0, convertedTotal: 0 };
    buckets.set(entry.currency, {
      count: current.count + 1,
      nativeTotal: current.nativeTotal + native,
      convertedTotal: current.convertedTotal + converted,
    });
  }
  const totalConverted = Array.from(buckets.values()).reduce((sum, item) => sum + item.convertedTotal, 0);
  return Array.from(buckets.entries())
    .map(([currency, stats], index) => ({
      currency,
      count: stats.count,
      nativeTotal: stats.nativeTotal,
      convertedTotal: stats.convertedTotal,
      percent: totalConverted ? (stats.convertedTotal / totalConverted) * 100 : 0,
      color: PIE_COLORS[index % PIE_COLORS.length],
    }))
    .sort((a, b) => b.convertedTotal - a.convertedTotal);
};

export const getHistoryDateBounds = (records: TravelHistoryRecord[]) => {
  const dates = records.flatMap((record) => [record.startDate, record.endDate, ...record.details.map((item) => item.date)]);
  const sorted = dates.filter(Boolean).sort();
  return {
    startDate: sorted[0] ?? "",
    endDate: sorted[sorted.length - 1] ?? "",
  };
};

export const mergeTravelHistoryRecords = (
  records: TravelHistoryRecord[],
  name: string,
  startDate: string,
  endDate: string,
  categories: readonly string[],
): TravelHistoryRecord => {
  const sortedRecords = [...records].sort((a, b) => a.savedAt - b.savedAt);
  const details = sortedRecords
    .flatMap((record) => record.details)
    .sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category));
  const categorySummary = summarizeHistoryCategories(details, categories);
  const totalAmount = details.reduce((sum, entry) => sum + entry.convertedAmount, 0);
  const primary = sortedRecords[0];
  return {
    id: `travel-${Date.now()}`,
    name: name.trim() || buildFallbackBillName(primary?.destinationCurrency),
    startDate,
    endDate,
    destinationCurrency: primary?.destinationCurrency ?? "HKD",
    targetCurrency: primary?.targetCurrency ?? "CNY",
    totalAmount,
    entryCount: details.length,
    categorySummary,
    details,
    savedAt: Date.now(),
    mergedFrom: sortedRecords.map((record) => record.id),
  };
};

export const detectTravelGeo = async (
  normalizeCurrencyInput: (value: unknown) => string | null,
): Promise<TravelGeoResult> => {
  const response = await fetch("https://ipapi.co/json/");
  if (!response.ok) throw new Error("定位服务无响应");
  const data = (await response.json()) as {
    currency?: string;
    country_name?: string;
    city?: string;
    region?: string;
  };
  const detected =
    normalizeCurrencyInput(data.currency) ??
    (() => {
      const code = normalizeCurrencyCode(data.currency);
      return /^[A-Z]{3}$/.test(code) && COMMON_ISO_4217_CODES.has(code) ? code : null;
    })();
  if (!detected) throw new Error("未获取到可用货币");
  const destinationCurrency = detected === "TWD" ? "NTD" : detected;
  const locationLabel = [data.city, data.region, data.country_name].filter(Boolean).join(" · ") || data.country_name || "";
  return {
    destinationCurrency,
    locationLabel,
    billName: buildBillNameFromLocation(locationLabel.split(" · ")[0] || data.country_name, destinationCurrency),
    countryName: data.country_name,
  };
};

export const normalizeStoredTravelState = (
  value: unknown,
  normalizeCurrencyInput: (value: unknown) => string | null,
): TravelState => {
  try {
    const parsed = value && typeof value === "object" ? value as Partial<TravelState> : {};
    const participants = normalizeTravelParticipants(parsed.participants);
    return {
      ...DEFAULT_TRAVEL_STATE,
      active: parsed.active === true,
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : null,
      endDate: typeof parsed.endDate === "string" ? parsed.endDate : null,
      plannedEndDate: typeof parsed.plannedEndDate === "string" ? parsed.plannedEndDate : null,
      destinationCurrency:
        normalizeCurrencyInput(parsed.destinationCurrency) ?? DEFAULT_TRAVEL_STATE.destinationCurrency,
      targetCurrency: normalizeCurrencyInput(parsed.targetCurrency) ?? DEFAULT_TRAVEL_STATE.targetCurrency,
      billName: typeof parsed.billName === "string" && parsed.billName.trim() ? parsed.billName.trim() : null,
      locationLabel:
        typeof parsed.locationLabel === "string" && parsed.locationLabel.trim() ? parsed.locationLabel.trim() : null,
      participants,
      entryMeta: normalizeTravelEntryMeta(parsed.entryMeta, participants),
      budget: normalizeTravelBudgetSettings(parsed.budget),
    };
  } catch {
    return DEFAULT_TRAVEL_STATE;
  }
};

export const readStoredTravelState = (
  normalizeCurrencyInput: (value: unknown) => string | null,
): TravelState => {
  try {
    return normalizeStoredTravelState(JSON.parse(localStorage.getItem(TRAVEL_KEY) ?? "{}"), normalizeCurrencyInput);
  } catch {
    return DEFAULT_TRAVEL_STATE;
  }
};

const migrateTravelHistoryRecord = (
  record: Partial<TravelHistoryRecord>,
  normalizeCurrencyInput: (value: unknown) => string | null,
): TravelHistoryRecord | null => {
  if (
    typeof record.id !== "string" ||
    typeof record.startDate !== "string" ||
    typeof record.endDate !== "string" ||
    typeof record.savedAt !== "number"
  ) {
    return null;
  }
  const destinationCurrency = normalizeCurrencyInput(record.destinationCurrency);
  const targetCurrency = normalizeCurrencyInput(record.targetCurrency);
  if (!destinationCurrency || !targetCurrency) return null;
  return {
    id: record.id,
    name:
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : buildLegacyHistoryName({
            startDate: record.startDate,
            destinationCurrency,
          }),
    startDate: record.startDate,
    endDate: record.endDate,
    destinationCurrency,
    targetCurrency,
    totalAmount: Number.isFinite(record.totalAmount) ? Number(record.totalAmount) : 0,
    entryCount: Number.isFinite(record.entryCount) ? Number(record.entryCount) : 0,
    categorySummary: Array.isArray(record.categorySummary)
      ? record.categorySummary
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const summary = row as Partial<TravelHistoryCategory>;
            return {
              category: typeof summary.category === "string" ? summary.category : "其他",
              value: Number.isFinite(summary.value) ? Number(summary.value) : 0,
              percent: Number.isFinite(summary.percent) ? Number(summary.percent) : 0,
            };
          })
      : [],
    details: Array.isArray(record.details)
      ? record.details
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const detail = row as Partial<TravelHistoryDetail>;
            const currency = normalizeCurrencyInput(detail.currency) ?? destinationCurrency;
            const participantIds = Array.isArray(detail.participantIds)
              ? detail.participantIds.filter((value): value is string => typeof value === "string")
              : undefined;
            const participantNames = Array.isArray(detail.participantNames)
              ? detail.participantNames.filter((value): value is string => typeof value === "string")
              : undefined;
            const exchangeSnapshot =
              detail.exchangeSnapshot && typeof detail.exchangeSnapshot === "object"
                ? detail.exchangeSnapshot as Partial<TravelExchangeSnapshot>
                : null;
            return {
              date: typeof detail.date === "string" ? detail.date : record.startDate!,
              category: typeof detail.category === "string" ? detail.category : "其他",
              amount: typeof detail.amount === "string" ? detail.amount : "",
              currency,
              note: typeof detail.note === "string" ? detail.note : "",
              convertedAmount: Number.isFinite(detail.convertedAmount) ? Number(detail.convertedAmount) : 0,
              locationLabel: typeof detail.locationLabel === "string" && detail.locationLabel.trim()
                ? detail.locationLabel.trim()
                : undefined,
              participantIds,
              participantNames,
              splitShare: Number.isFinite(detail.splitShare) ? Number(detail.splitShare) : undefined,
              exchangeSnapshot:
                exchangeSnapshot &&
                typeof exchangeSnapshot.from === "string" &&
                typeof exchangeSnapshot.to === "string" &&
                Number.isFinite(exchangeSnapshot.rate) &&
                Number.isFinite(exchangeSnapshot.convertedAmount) &&
                typeof exchangeSnapshot.updatedAt === "number"
                  ? {
                      from: exchangeSnapshot.from,
                      to: exchangeSnapshot.to,
                      rate: Number(exchangeSnapshot.rate),
                      source: typeof exchangeSnapshot.source === "string" ? exchangeSnapshot.source : "unknown",
                      updatedAt: exchangeSnapshot.updatedAt,
                      convertedAmount: Number(exchangeSnapshot.convertedAmount),
                    }
                  : undefined,
            };
          })
      : [],
    participants: normalizeTravelParticipants(record.participants),
    splitSummary: Array.isArray(record.splitSummary)
      ? record.splitSummary
          .filter((row) => row && typeof row === "object")
          .map((row) => {
            const summary = row as Partial<TravelSplitSummary>;
            return {
              participantId: typeof summary.participantId === "string" ? summary.participantId : "",
              name: typeof summary.name === "string" ? summary.name : "同行人",
              owed: Number.isFinite(summary.owed) ? Number(summary.owed) : 0,
            };
          })
          .filter((row) => row.participantId)
      : undefined,
    budget: normalizeTravelBudgetSettings(record.budget),
    savedAt: record.savedAt,
    mergedFrom: Array.isArray(record.mergedFrom)
      ? record.mergedFrom.filter((value): value is string => typeof value === "string")
      : undefined,
  };
};

export const purgeExpiredPendingDeletes = (
  items: PendingTravelHistoryDelete[],
  now = Date.now(),
): PendingTravelHistoryDelete[] =>
  items.filter((item) => now - item.deletedAt < PENDING_DELETE_TTL_MS);

export const normalizeStoredPendingTravelDeletes = (
  value: unknown,
  normalizeCurrencyInput: (value: unknown) => string | null,
): PendingTravelHistoryDelete[] => {
  try {
    if (!Array.isArray(value)) return [];
    return purgeExpiredPendingDeletes(
      value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const pending = item as Partial<PendingTravelHistoryDelete>;
          if (typeof pending.deletedAt !== "number" || !pending.record || typeof pending.record !== "object") {
            return null;
          }
          const record = migrateTravelHistoryRecord(
            pending.record as Partial<TravelHistoryRecord>,
            normalizeCurrencyInput,
          );
          if (!record) return null;
          return { record, deletedAt: pending.deletedAt };
        })
        .filter((item): item is PendingTravelHistoryDelete => Boolean(item)),
    );
  } catch {
    return [];
  }
};

export const readStoredPendingTravelDeletes = (
  normalizeCurrencyInput: (value: unknown) => string | null,
): PendingTravelHistoryDelete[] => {
  try {
    return normalizeStoredPendingTravelDeletes(
      JSON.parse(localStorage.getItem(TRAVEL_HISTORY_PENDING_DELETE_KEY) ?? "[]"),
      normalizeCurrencyInput,
    );
  } catch {
    return [];
  }
};

export const normalizeStoredTravelHistory = (
  value: unknown,
  normalizeCurrencyInput: (value: unknown) => string | null,
): TravelHistoryRecord[] => {
  try {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        return migrateTravelHistoryRecord(item as Partial<TravelHistoryRecord>, normalizeCurrencyInput);
      })
      .filter((record): record is TravelHistoryRecord => Boolean(record))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
};

export const readStoredTravelHistory = (
  normalizeCurrencyInput: (value: unknown) => string | null,
): TravelHistoryRecord[] => {
  try {
    return normalizeStoredTravelHistory(JSON.parse(localStorage.getItem(TRAVEL_HISTORY_KEY) ?? "[]"), normalizeCurrencyInput);
  } catch {
    return [];
  }
};
