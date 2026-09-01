import { afterEach, describe, expect, it } from "vitest";
import { clearAllPersistedData } from "./clearPersistedData";
import { kvGet, kvSet, resetKvForTests } from "./kv";
import { LLM_CALL_LOG_KEY, PERSISTED_KV_KEYS, STORAGE_KEY } from "./storageKeys";

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

const installSessionStorage = () => {
  const session = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
    },
  });
};

afterEach(() => {
  resetKvForTests();
  memory.clear();
});

describe("clearAllPersistedData", () => {
  it("removes every persisted kv key and the session LLM log", () => {
    installLocalStorage();
    installSessionStorage();
    for (const key of PERSISTED_KV_KEYS) kvSet(key, "keep");
    sessionStorage.setItem(LLM_CALL_LOG_KEY, "[]");
    kvSet("unrelated-other-app", "stay");
    clearAllPersistedData();
    expect(kvGet(STORAGE_KEY)).toBeNull();
    for (const key of PERSISTED_KV_KEYS) expect(kvGet(key)).toBeNull();
    expect(sessionStorage.getItem(LLM_CALL_LOG_KEY)).toBeNull();
    expect(kvGet("unrelated-other-app")).toBe("stay");
  });
});
