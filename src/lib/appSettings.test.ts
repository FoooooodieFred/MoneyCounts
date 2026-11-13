import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS, normalizeAppSettings } from "./appSettings";

describe("app settings", () => {
  it("shows greetings for older backups and preserves the hidden preference", () => {
    expect(normalizeAppSettings({}).showHomeGreeting).toBe(true);
    const settings = normalizeAppSettings({ showHomeGreeting: false });
    expect(normalizeAppSettings(JSON.parse(JSON.stringify(settings))).showHomeGreeting).toBe(false);
  });
  it("keeps MoneyMore ledger mutation off unless explicitly enabled", () => {
    expect(DEFAULT_APP_SETTINGS.moneyMoreCanMutateLedger).toBe(false);
    expect(normalizeAppSettings({}).moneyMoreCanMutateLedger).toBe(false);
    expect(normalizeAppSettings({ moneyMoreCanMutateLedger: true }).moneyMoreCanMutateLedger).toBe(
      true,
    );
  });
});
