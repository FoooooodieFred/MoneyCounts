import { afterEach, describe, expect, it } from "vitest";
import {
  emptyDesktopStore,
  hydrateDesktopStore,
  isDesktopKv,
  kvGet,
  kvRemove,
  kvSet,
  parseDesktopStore,
  resetKvForTests,
  serializeDesktopStore,
} from "./kv";
import type { DesktopAppBindings } from "./desktopRuntime";

const memory = new Map<string, string>();

const ensureWindow = () => {
  if (typeof globalThis.window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        setTimeout: globalThis.setTimeout.bind(globalThis),
      },
    });
  }
  return globalThis.window;
};

const installLocalStorage = () => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
};

const installDesktopApp = (keys: Record<string, string> = {}): DesktopAppBindings => {
  const app: DesktopAppBindings = {
    LoadStore: async () => serializeDesktopStore(keys),
    SaveStore: async () => undefined,
    SaveTextFile: async () => "",
    OpenTextFile: async () => ({ name: "", contents: "", size: 0, cancelled: true }),
    NotifyFlushed: async () => undefined,
  };
  ensureWindow().go = { main: { App: app } };
  return app;
};

afterEach(() => {
  resetKvForTests();
  memory.clear();
  const win = globalThis.window;
  if (win) {
    win.go = undefined;
    win.runtime = undefined;
  }
});

describe("desktop store file", () => {
  it("round-trips keys and ignores non-string values", () => {
    const raw = serializeDesktopStore({ "monthly-smart-ledger:v1": "{}" });
    expect(parseDesktopStore(raw).keys).toEqual({ "monthly-smart-ledger:v1": "{}" });
    expect(parseDesktopStore("not-json")).toEqual(emptyDesktopStore());
    expect(parseDesktopStore(JSON.stringify({ keys: { a: 1, b: "ok" } })).keys).toEqual({
      b: "ok",
    });
  });
});

describe("web kv", () => {
  it("reads and writes localStorage", () => {
    installLocalStorage();
    expect(isDesktopKv()).toBe(false);
    expect(kvGet("k")).toBeNull();
    expect(kvSet("k", "v")).toEqual({ ok: true });
    expect(kvGet("k")).toBe("v");
    kvRemove("k");
    expect(kvGet("k")).toBeNull();
  });
});

describe("desktop kv", () => {
  it("uses the in-memory map when Wails bindings exist, not LocalStorage", async () => {
    installLocalStorage();
    installDesktopApp({ "monthly-smart-ledger:v1": "from-file" });
    await hydrateDesktopStore();
    expect(isDesktopKv()).toBe(true);
    expect(kvGet("monthly-smart-ledger:v1")).toBe("from-file");
    expect(kvSet("monthly-smart-ledger:v1", "next")).toEqual({ ok: true });
    expect(localStorage.getItem("monthly-smart-ledger:v1")).toBeNull();
    expect(kvGet("monthly-smart-ledger:v1")).toBe("next");
  });

  it("skips LocalStorage as soon as the Wails shell is present", () => {
    installLocalStorage();
    ensureWindow().runtime = { EventsOn: () => undefined };
    expect(isDesktopKv()).toBe(true);
    expect(kvSet("k", "v")).toEqual({ ok: true });
    expect(localStorage.getItem("k")).toBeNull();
    expect(kvGet("k")).toBe("v");
  });
});
