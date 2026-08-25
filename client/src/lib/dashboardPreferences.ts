export type PreferredCurrency = "usd" | "jpy";
export type PreferredChartView = "price" | "volume" | "candle";

export type DashboardPreferences = {
  currency: PreferredCurrency;
  chartView: PreferredChartView;
};

export const DASHBOARD_PREFERENCES_KEY = "atlas.crypto.dashboard-preferences.v1";
export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreferences = { currency: "usd", chartView: "price" };

function isPreferences(value: unknown): value is DashboardPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Partial<DashboardPreferences>;
  return (preferences.currency === "usd" || preferences.currency === "jpy")
    && (preferences.chartView === "price" || preferences.chartView === "volume" || preferences.chartView === "candle");
}

export function loadDashboardPreferences(storage: Pick<Storage, "getItem"> | null | undefined): DashboardPreferences {
  if (!storage) return DEFAULT_DASHBOARD_PREFERENCES;
  try {
    const parsed = JSON.parse(storage.getItem(DASHBOARD_PREFERENCES_KEY) ?? "null");
    return isPreferences(parsed) ? parsed : DEFAULT_DASHBOARD_PREFERENCES;
  } catch {
    return DEFAULT_DASHBOARD_PREFERENCES;
  }
}

export function saveDashboardPreferences(preferences: DashboardPreferences, storage: Pick<Storage, "setItem"> | null | undefined) {
  if (!storage || !isPreferences(preferences)) return;
  storage.setItem(DASHBOARD_PREFERENCES_KEY, JSON.stringify(preferences));
}
