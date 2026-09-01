import { trySetLocalStorageItem } from "./localStorageQuota";
import { getDesktopApp, hasWailsShell, isDesktopBuild } from "./desktopRuntime";

export const DESKTOP_STORE_KIND = "desktop-store";
export const DESKTOP_STORE_VERSION = 1;
export const DESKTOP_STORE_FLUSH_MS = 400;

export type DesktopStoreFile = {
  app: "MoneyCounts";
  kind: typeof DESKTOP_STORE_KIND;
  version: typeof DESKTOP_STORE_VERSION;
  keys: Record<string, string>;
};

export type KvWriteResult = { ok: true } | { ok: false; quotaExceeded: boolean };

let desktop = false;
const memory = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const useDesktopKv = (): boolean => desktop || isDesktopBuild() || hasWailsShell();

export const isDesktopKv = (): boolean => useDesktopKv();

export const emptyDesktopStore = (): DesktopStoreFile => ({
  app: "MoneyCounts",
  kind: DESKTOP_STORE_KIND,
  version: DESKTOP_STORE_VERSION,
  keys: {},
});

export const parseDesktopStore = (raw: string): DesktopStoreFile => {
  try {
    const parsed = JSON.parse(raw) as Partial<DesktopStoreFile>;
    if (!parsed || typeof parsed !== "object") return emptyDesktopStore();
    const keys =
      parsed.keys && typeof parsed.keys === "object" && !Array.isArray(parsed.keys)
        ? Object.fromEntries(
            Object.entries(parsed.keys).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {};
    return {
      app: "MoneyCounts",
      kind: DESKTOP_STORE_KIND,
      version: DESKTOP_STORE_VERSION,
      keys,
    };
  } catch {
    return emptyDesktopStore();
  }
};

export const serializeDesktopStore = (keys: Record<string, string>): string =>
  JSON.stringify({
    app: "MoneyCounts",
    kind: DESKTOP_STORE_KIND,
    version: DESKTOP_STORE_VERSION,
    keys,
  });

export const kvGet = (key: string): string | null => {
  if (useDesktopKv()) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const kvSet = (key: string, value: string): KvWriteResult => {
  if (useDesktopKv()) {
    memory.set(key, value);
    scheduleFlush();
    return { ok: true };
  }
  return trySetLocalStorageItem(key, value);
};

export const kvRemove = (key: string) => {
  if (useDesktopKv()) {
    memory.delete(key);
    scheduleFlush();
    return;
  }
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
};

export const hydrateDesktopStore = async () => {
  if (!isDesktopBuild() && !hasWailsShell()) return;
  desktop = true;
  let app = getDesktopApp();
  for (let attempt = 0; attempt < 20 && !app; attempt += 1) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 50);
    });
    app = getDesktopApp();
  }
  if (!app) return;
  const raw = await app.LoadStore();
  const parsed = parseDesktopStore(raw);
  memory.clear();
  for (const [key, value] of Object.entries(parsed.keys)) memory.set(key, value);
};

export const flushDesktopStore = async () => {
  if (!useDesktopKv()) return;
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const app = getDesktopApp();
  if (!app) return;
  await app.SaveStore(serializeDesktopStore(Object.fromEntries(memory)));
};

const scheduleFlush = () => {
  if (!useDesktopKv() || typeof window === "undefined") return;
  if (flushTimer != null) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushDesktopStore();
  }, DESKTOP_STORE_FLUSH_MS);
};

export const resetKvForTests = () => {
  desktop = false;
  memory.clear();
  if (flushTimer != null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

export const measureDesktopStoreUtf8Bytes = (): number => {
  try {
    return new TextEncoder().encode(serializeDesktopStore(Object.fromEntries(memory))).length;
  } catch {
    return 0;
  }
};
