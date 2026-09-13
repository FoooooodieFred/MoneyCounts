import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./appSettings";

describe("app settings", () => {
  it("keeps MoneyMore ledger mutation off unless explicitly enabled", () => {
    expect(DEFAULT_APP_SETTINGS.moneyMoreCanMutateLedger).toBe(false);
    expect(normalizeAppSettings({}).moneyMoreCanMutateLedger).toBe(false);
    expect(normalizeAppSettings({ moneyMoreCanMutateLedger: true }).moneyMoreCanMutateLedger).toBe(
      true,
    );
  });
});
