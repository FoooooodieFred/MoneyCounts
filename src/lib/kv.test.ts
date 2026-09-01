import { afterEach, describe, expect, it } from "vitest";
import {
  emptyDesktopStore,
  kvGet,
  kvRemove,
  kvSet,
  parseDesktopStore,
  resetKvForTests,
  serializeDesktopStore,
} from "./kv";

const memory = new Map<string, string>();

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

afterEach(() => {
  resetKvForTests();
  memory.clear();
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
    expect(kvGet("k")).toBeNull();
    expect(kvSet("k", "v")).toEqual({ ok: true });
    expect(kvGet("k")).toBe("v");
    kvRemove("k");
    expect(kvGet("k")).toBeNull();
  });
});
