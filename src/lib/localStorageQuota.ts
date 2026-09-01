/**
 * LocalStorage 容量估算与安全写入。
 * Chromium / Edge 通常按 UTF-16 计，整站合计约 5 MiB。
 * 本账本每个有内容的日期会存满 35×50 空格子，几十个日期就会顶满。
 */
import { CURRENT_DAY_SLOT_COUNT } from "./ledgerLayout";

export const LOCAL_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024;
export const STORAGE_WARN_RATIO = 0.7;
export const STORAGE_BLOCK_RATIO = 0.92;
export const IMPORT_FILE_PARSE_LIMIT_BYTES = 8 * 1024 * 1024;

const SAMPLE_BLANK_SLOT = '{"amount":"","currency":"HKD","note":"","hidden":false}';

/** 按当前日格子布局估算「有内容的一天」写入 UTF-16 字节。 */
export const ESTIMATED_UTF16_BYTES_PER_OCCUPIED_DAY =
  (CURRENT_DAY_SLOT_COUNT * (SAMPLE_BLANK_SLOT.length + 1) + 48) * 2;

export type StoragePressure = "ok" | "warn" | "block";

export type StorageLike = Pick<Storage, "getItem" | "key" | "length">;

export const utf16ByteLength = (value: string) => value.length * 2;

export const formatStorageBytes = (bytes: number): string => {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const classifyStoragePressure = (
  projectedBytes: number,
  quotaBytes: number = LOCAL_STORAGE_QUOTA_BYTES,
): StoragePressure => {
  if (projectedBytes >= quotaBytes * STORAGE_BLOCK_RATIO) return "block";
  if (projectedBytes >= quotaBytes * STORAGE_WARN_RATIO) return "warn";
  return "ok";
};

export const measureStorageUtf16Bytes = (storage: StorageLike): number => {
  let total = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key == null) continue;
    total += utf16ByteLength(key) + utf16ByteLength(storage.getItem(key) ?? "");
  }
  return total;
};

export const measureLocalStorageBytes = (): number => {
  if (typeof localStorage === "undefined") return 0;
  try {
    return measureStorageUtf16Bytes(localStorage);
  } catch {
    return 0;
  }
};

export const projectReplacingKeyBytes = (
  currentTotalBytes: number,
  previousValueBytes: number,
  nextValueBytes: number,
): number => currentTotalBytes - previousValueBytes + nextValueBytes;

export const projectLocalStorageReplace = (
  key: string,
  nextValue: string,
  storage?: StorageLike,
): number => {
  const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  if (!store) return utf16ByteLength(key) + utf16ByteLength(nextValue);
  const currentTotal = measureStorageUtf16Bytes(store);
  const previous = store.getItem(key) ?? "";
  return projectReplacingKeyBytes(
    currentTotal,
    utf16ByteLength(key) + utf16ByteLength(previous),
    utf16ByteLength(key) + utf16ByteLength(nextValue),
  );
};

export const estimateOccupiedLedgerUtf16Bytes = (occupiedDayCount: number): number =>
  Math.max(0, occupiedDayCount) * ESTIMATED_UTF16_BYTES_PER_OCCUPIED_DAY;

export const estimateUtf16BytesFromUtf8FileSize = (fileSize: number): number =>
  Math.max(0, fileSize) * 2;

export const classifyImportFileSize = (
  fileSize: number,
  kind: "json" | "table",
): StoragePressure => {
  if (fileSize >= IMPORT_FILE_PARSE_LIMIT_BYTES) return "block";
  if (kind === "json") {
    return classifyStoragePressure(estimateUtf16BytesFromUtf8FileSize(fileSize));
  }
  return "ok";
};

export const isQuotaExceededError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: number };
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22
  );
};

export const trySetLocalStorageItem = (
  key: string,
  value: string,
  storage?: Pick<Storage, "setItem">,
): { ok: true } | { ok: false; quotaExceeded: boolean } => {
  const store = storage ?? (typeof localStorage === "undefined" ? null : localStorage);
  if (!store) return { ok: false, quotaExceeded: false };
  try {
    store.setItem(key, value);
    return { ok: true };
  } catch (error) {
    return { ok: false, quotaExceeded: isQuotaExceededError(error) };
  }
};
