import { describe, expect, it } from "vitest";
import { CURRENT_DAY_SLOT_COUNT } from "./ledgerLayout";
import {
  ESTIMATED_UTF16_BYTES_PER_OCCUPIED_DAY,
  IMPORT_FILE_PARSE_LIMIT_BYTES,
  LOCAL_STORAGE_QUOTA_BYTES,
  classifyImportFileSize,
  classifyStoragePressure,
  estimateOccupiedLedgerUtf16Bytes,
  estimateUtf16BytesFromUtf8FileSize,
  formatStorageBytes,
  isQuotaExceededError,
  measureStorageUtf16Bytes,
  projectLocalStorageReplace,
  projectReplacingKeyBytes,
  trySetLocalStorageItem,
  utf16ByteLength,
} from "./localStorageQuota";

const makeMemoryStorage = (seed: Record<string, string> = {}) => {
  const memory = new Map(Object.entries(seed));
  const storage = {
    get length() {
      return memory.size;
    },
    key: (index: number) => [...memory.keys()][index] ?? null,
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
  };
  return { memory, storage };
};

describe("localStorageQuota", () => {
  it("counts UTF-16 bytes and formats sizes", () => {
    expect(utf16ByteLength("ab")).toBe(4);
    expect(formatStorageBytes(800)).toBe("800 B");
    expect(formatStorageBytes(2048)).toBe("2.0 KB");
    expect(formatStorageBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("classifies pressure against the 5 MiB web quota", () => {
    expect(classifyStoragePressure(LOCAL_STORAGE_QUOTA_BYTES * 0.5)).toBe("ok");
    expect(classifyStoragePressure(LOCAL_STORAGE_QUOTA_BYTES * 0.71)).toBe("warn");
    expect(classifyStoragePressure(LOCAL_STORAGE_QUOTA_BYTES * 0.93)).toBe("block");
  });

  it("projects replacing one key without double-counting", () => {
    const { storage } = makeMemoryStorage({
      "monthly-smart-ledger:v1": "old",
      other: "xx",
    });
    const current = measureStorageUtf16Bytes(storage);
    expect(current).toBeGreaterThan(0);
    const projected = projectLocalStorageReplace("monthly-smart-ledger:v1", "newer-value", storage);
    expect(projected).toBe(
      projectReplacingKeyBytes(
        current,
        utf16ByteLength("monthly-smart-ledger:v1") + utf16ByteLength("old"),
        utf16ByteLength("monthly-smart-ledger:v1") + utf16ByteLength("newer-value"),
      ),
    );
  });

  it("estimates occupied days using the 35×50 slot layout", () => {
    expect(CURRENT_DAY_SLOT_COUNT).toBe(1750);
    expect(ESTIMATED_UTF16_BYTES_PER_OCCUPIED_DAY).toBeGreaterThan(100_000);
    expect(estimateOccupiedLedgerUtf16Bytes(50)).toBeGreaterThan(LOCAL_STORAGE_QUOTA_BYTES);
    expect(estimateOccupiedLedgerUtf16Bytes(0)).toBe(0);
  });

  it("blocks oversized import files and near-quota JSON backups", () => {
    expect(classifyImportFileSize(1000, "table")).toBe("ok");
    expect(classifyImportFileSize(IMPORT_FILE_PARSE_LIMIT_BYTES, "table")).toBe("block");
    expect(classifyImportFileSize(2.5 * 1024 * 1024, "json")).toBe("block");
    expect(classifyImportFileSize(5 * 1024 * 1024, "json")).toBe("block");
    expect(estimateUtf16BytesFromUtf8FileSize(1024)).toBe(2048);
  });

  it("swallows quota errors from setItem", () => {
    const storage = {
      setItem: () => {
        const error = new Error("full");
        error.name = "QuotaExceededError";
        throw error;
      },
    };
    expect(trySetLocalStorageItem("k", "v", storage)).toEqual({
      ok: false,
      quotaExceeded: true,
    });
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(trySetLocalStorageItem("k", "v", { setItem: () => undefined })).toEqual({ ok: true });
  });
});
