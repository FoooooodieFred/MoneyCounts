import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LEDGER_PARSE_MODE,
  LEDGER_PARSE_MODE_KEY,
  ledgerParseModeLabel,
  normalizeLedgerParseMode,
  readLedgerParseMode,
  saveLedgerParseMode,
} from "./ledgerParseMode";

const memory = new Map<string, string>();

beforeEach(() => {
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
});

afterEach(() => {
  memory.clear();
});

describe("ledgerParseMode", () => {
  it("defaults to local rules and rejects unknown values", () => {
    expect(normalizeLedgerParseMode(undefined)).toBe("rules");
    expect(normalizeLedgerParseMode("gpt")).toBe(DEFAULT_LEDGER_PARSE_MODE);
    expect(ledgerParseModeLabel("rules")).toBe("规则识别·快且本地");
    expect(ledgerParseModeLabel("llm")).toBe("LLM识别·精确有效");
  });

  it("persists the selected parse mode", () => {
    expect(readLedgerParseMode()).toBe("rules");
    saveLedgerParseMode("llm");
    expect(memory.get(LEDGER_PARSE_MODE_KEY)).toBe("llm");
    expect(readLedgerParseMode()).toBe("llm");
  });
});
