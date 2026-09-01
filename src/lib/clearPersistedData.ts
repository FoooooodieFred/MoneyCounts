import { kvRemove } from "./kv";
import { LLM_CALL_LOG_KEY, PERSISTED_KV_KEYS } from "./storageKeys";

export const clearAllPersistedData = () => {
  for (const key of PERSISTED_KV_KEYS) kvRemove(key);
  try {
    sessionStorage.removeItem(LLM_CALL_LOG_KEY);
  } catch {
    /* private mode / missing sessionStorage */
  }
};
