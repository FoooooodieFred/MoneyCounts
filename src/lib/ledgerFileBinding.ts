import { PERSISTED_KV_KEYS } from "./storageKeys";
import { kvGet, serializeDesktopStore } from "./kv";

const DB_NAME = "moneycounts-ledger-file";
const STORE_NAME = "handles";
const HANDLE_KEY = "ledger-file";

type FileHandleLike = {
  name: string;
  queryPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: string }) => Promise<PermissionState>;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

const canPickFile = () =>
  typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readHandle = async (): Promise<FileHandleLike | null> => {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
      request.onsuccess = () => resolve((request.result as FileHandleLike | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
};

const writeHandle = async (handle: FileHandleLike) => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const ensurePermission = async (handle: FileHandleLike) => {
  const mode = { mode: "readwrite" as const };
  if (handle.queryPermission) {
    const current = await handle.queryPermission(mode);
    if (current === "granted") return true;
  }
  if (handle.requestPermission) {
    return (await handle.requestPermission(mode)) === "granted";
  }
  return true;
};

export const snapshotPersistedKv = () => {
  const keys: Record<string, string> = {};
  for (const key of PERSISTED_KV_KEYS) {
    const value = kvGet(key);
    if (value != null) keys[key] = value;
  }
  return serializeDesktopStore(keys);
};

export const getBoundLedgerFileName = async () => {
  const handle = await readHandle();
  return handle?.name ?? null;
};

export const bindLedgerFile = async (): Promise<string | null> => {
  if (!canPickFile() || !window.showSaveFilePicker) return null;
  const handle = await window.showSaveFilePicker({
    suggestedName: "moneycounts-store.json",
    types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
  });
  await writeHandle(handle as unknown as FileHandleLike);
  await writeBoundLedgerFile();
  return handle.name;
};

export const writeBoundLedgerFile = async () => {
  const handle = await readHandle();
  if (!handle) return false;
  if (!(await ensurePermission(handle))) return false;
  const writable = await handle.createWritable();
  await writable.write(snapshotPersistedKv());
  await writable.close();
  return true;
};

export const canBindLedgerFile = canPickFile;
