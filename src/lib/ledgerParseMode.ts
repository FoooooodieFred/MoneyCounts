/**
 * 首页自然语言记账的识别方式。独立 LocalStorage key，不进 JSON 备份。
 */
import { kvGet, kvSet } from "./kv";
import { LEDGER_PARSE_MODE_KEY } from "./storageKeys";

export { LEDGER_PARSE_MODE_KEY };

export const LEDGER_PARSE_MODES = ["rules", "llm"] as const;

export type LedgerParseMode = (typeof LEDGER_PARSE_MODES)[number];

export const LEDGER_PARSE_MODE_OPTIONS: readonly {
  id: LedgerParseMode;
  label: string;
}[] = [
  { id: "rules", label: "本地" },
  { id: "llm", label: "AI" },
];

export const DEFAULT_LEDGER_PARSE_MODE: LedgerParseMode = "rules";

export const isLedgerParseMode = (value: unknown): value is LedgerParseMode =>
  typeof value === "string" && LEDGER_PARSE_MODES.includes(value as LedgerParseMode);

export const ledgerParseModeLabel = (mode: LedgerParseMode) =>
  LEDGER_PARSE_MODE_OPTIONS.find((item) => item.id === mode)?.label ??
  LEDGER_PARSE_MODE_OPTIONS[0].label;

export const normalizeLedgerParseMode = (value: unknown): LedgerParseMode =>
  isLedgerParseMode(value) ? value : DEFAULT_LEDGER_PARSE_MODE;

export const readLedgerParseMode = (): LedgerParseMode => {
  try {
    return normalizeLedgerParseMode(kvGet(LEDGER_PARSE_MODE_KEY));
  } catch {
    return DEFAULT_LEDGER_PARSE_MODE;
  }
};

export const saveLedgerParseMode = (mode: LedgerParseMode) => {
  kvSet(LEDGER_PARSE_MODE_KEY, normalizeLedgerParseMode(mode));
};
