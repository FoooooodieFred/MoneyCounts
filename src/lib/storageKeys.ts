/** 本机持久化 key。网页版对应 LocalStorage；客户端对应 store.json 的 keys。勿改字符串。 */

export const STORAGE_KEY = "monthly-smart-ledger:v1";
export const RATE_KEY = "monthly-smart-ledger:exchange";
export const LAST_CURRENCY_KEY = "monthly-smart-ledger:last-currency";
export const STATS_CURRENCIES_KEY = "monthly-smart-ledger:stats-currencies";
export const CUSTOM_CURRENCIES_KEY = "monthly-smart-ledger:custom-currencies";
export const THEME_KEY = "monthly-smart-ledger:theme";
export const BACKUP_REMINDER_KEY = "monthly-smart-ledger:backup-reminder";
export const APP_SETTINGS_KEY = "monthly-smart-ledger:settings";
export const TRAVEL_KEY = "monthly-smart-ledger:travel";
export const TRAVEL_HISTORY_KEY = "monthly-smart-ledger:travel-history";
export const TRAVEL_HISTORY_PENDING_DELETE_KEY =
  "monthly-smart-ledger:travel-history-pending-delete";
export const LLM_API_SETTINGS_KEY = "monthly-smart-ledger:llm-api:v1";
export const LEDGER_PARSE_MODE_KEY = "monthly-smart-ledger:ledger-parse-mode";
export const SIDEBAR_COLLAPSED_KEY = "moneycounts:sidebar-collapsed";
export const LLM_CALL_LOG_KEY = "monthly-smart-ledger:llm-call-log:v1";

/** 清空全部数据时删除的 kv 项（不含 sessionStorage 的 LLM 调用日志）。 */
export const PERSISTED_KV_KEYS = [
  STORAGE_KEY,
  RATE_KEY,
  LAST_CURRENCY_KEY,
  STATS_CURRENCIES_KEY,
  CUSTOM_CURRENCIES_KEY,
  THEME_KEY,
  BACKUP_REMINDER_KEY,
  APP_SETTINGS_KEY,
  TRAVEL_KEY,
  TRAVEL_HISTORY_KEY,
  TRAVEL_HISTORY_PENDING_DELETE_KEY,
  LLM_API_SETTINGS_KEY,
  LEDGER_PARSE_MODE_KEY,
  SIDEBAR_COLLAPSED_KEY,
] as const;
