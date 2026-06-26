import type { AppSettings } from "./appSettings";

export const BACKUP_VERSION = 1;

export type BackupLedgerEntry = {
  amount?: unknown;
  currency?: unknown;
  note?: unknown;
  hidden?: unknown;
};

export type BackupLedger = Record<string, BackupLedgerEntry[]>;

export type MoneyCountsBackupPayload = {
  app: "MoneyCounts";
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    ledger: BackupLedger;
    exchange?: unknown;
    lastCurrency?: unknown;
    statsCurrencies?: unknown;
    customCurrencies?: unknown;
    theme?: unknown;
    backupReminder?: unknown;
    settings?: AppSettings;
    travelState?: unknown;
    travelHistory?: unknown;
    pendingTravelDeletes?: unknown;
  };
};

export type LedgerSummary = {
  dateCount: number;
  recordCount: number;
};

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const summarizeLedger = (ledger: Record<string, BackupLedgerEntry[]>): LedgerSummary => {
  const dates = Object.entries(ledger).filter(([, entries]) =>
    entries.some((entry) => {
      const amount = typeof entry.amount === "string" ? entry.amount : "";
      const note = typeof entry.note === "string" ? entry.note : "";
      return Boolean(amount.trim() || note.trim());
    }),
  );

  return {
    dateCount: dates.length,
    recordCount: dates.reduce(
      (total, [, entries]) =>
        total +
        entries.filter((entry) => {
          const amount = typeof entry.amount === "string" ? entry.amount : "";
          const note = typeof entry.note === "string" ? entry.note : "";
          return Boolean(amount.trim() || note.trim());
        }).length,
      0,
    ),
  };
};

export const buildBackupPayload = (data: MoneyCountsBackupPayload["data"]): MoneyCountsBackupPayload => ({
  app: "MoneyCounts",
  version: BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  data,
});

export const parseBackupPayload = (value: unknown): MoneyCountsBackupPayload => {
  if (!isPlainRecord(value)) throw new Error("JSON 顶层结构无效。");
  if (value.app !== "MoneyCounts") throw new Error("不是 MoneyCounts 备份文件。");
  if (value.version !== BACKUP_VERSION) throw new Error(`暂不支持的备份版本：${String(value.version ?? "未知")}`);
  if (typeof value.exportedAt !== "string") throw new Error("缺少导出时间。");
  if (!isPlainRecord(value.data)) throw new Error("缺少备份数据。");
  if (!isPlainRecord(value.data.ledger)) throw new Error("账本结构无效。");

  return value as MoneyCountsBackupPayload;
};

export const makeBackupFilename = (exportedAt = new Date()) => {
  const date = exportedAt.toISOString().slice(0, 10);
  return `moneycounts-backup-v${BACKUP_VERSION}-${date}.json`;
};
