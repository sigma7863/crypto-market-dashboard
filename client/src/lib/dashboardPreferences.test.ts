import { describe, expect, it } from "vitest";
import { DASHBOARD_PREFERENCES_KEY, DEFAULT_DASHBOARD_PREFERENCES, loadDashboardPreferences, saveDashboardPreferences } from "./dashboardPreferences";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
}

describe("dashboard preferences", () => {
  it("uses safe defaults when no saved preference exists", () => {
    expect(loadDashboardPreferences(createStorage())).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });

  it("restores valid currency and chart preferences", () => {
    const storage = createStorage({ [DASHBOARD_PREFERENCES_KEY]: '{"currency":"jpy","chartView":"candle"}' });
    expect(loadDashboardPreferences(storage)).toEqual({ currency: "jpy", chartView: "candle" });
  });

  it("persists validated preferences and ignores malformed stored values", () => {
    const storage = createStorage();
    saveDashboardPreferences({ currency: "jpy", chartView: "volume" }, storage);
    expect(loadDashboardPreferences(storage)).toEqual({ currency: "jpy", chartView: "volume" });
    expect(loadDashboardPreferences(createStorage({ [DASHBOARD_PREFERENCES_KEY]: '{"currency":"eur"}' }))).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });
});
