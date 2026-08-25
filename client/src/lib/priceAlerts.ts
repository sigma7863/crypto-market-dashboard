export type AlertDirection = "above" | "below";

export type PriceAlert = {
  id: string;
  coinId: string;
  currency: "usd" | "jpy";
  direction: AlertDirection;
  target: number;
  createdAt: number;
  triggeredAt?: number;
};

export const PRICE_ALERT_STORAGE_KEY = "atlas.crypto.price-alerts.v1";

function isPriceAlert(value: unknown): value is PriceAlert {
  if (!value || typeof value !== "object") return false;
  const alert = value as Partial<PriceAlert>;
  return typeof alert.id === "string" && /^[a-z0-9-]+$/.test(alert.coinId ?? "")
    && (alert.currency === "usd" || alert.currency === "jpy")
    && (alert.direction === "above" || alert.direction === "below")
    && typeof alert.target === "number" && Number.isFinite(alert.target) && alert.target > 0
    && typeof alert.createdAt === "number";
}

export function loadPriceAlerts(storage: Pick<Storage, "getItem"> | null | undefined): PriceAlert[] {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PRICE_ALERT_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isPriceAlert) : [];
  } catch {
    return [];
  }
}

export function savePriceAlerts(alerts: PriceAlert[], storage: Pick<Storage, "setItem"> | null | undefined) {
  if (!storage) return;
  storage.setItem(PRICE_ALERT_STORAGE_KEY, JSON.stringify(alerts.filter(isPriceAlert)));
}

export function createPriceAlert(input: Omit<PriceAlert, "id" | "createdAt" | "triggeredAt">, now: number): PriceAlert {
  return { ...input, id: `${input.coinId}-${input.currency}-${input.direction}-${input.target}-${now}`, createdAt: now };
}

export function evaluatePriceAlerts(alerts: PriceAlert[], prices: Record<string, number>, now: number) {
  const newlyTriggered: PriceAlert[] = [];
  const next = alerts.map(alert => {
    if (alert.triggeredAt || prices[`${alert.coinId}:${alert.currency}`] === undefined) return alert;
    const price = prices[`${alert.coinId}:${alert.currency}`];
    const matches = alert.direction === "above" ? price >= alert.target : price <= alert.target;
    if (!matches) return alert;
    const triggered = { ...alert, triggeredAt: now };
    newlyTriggered.push(triggered);
    return triggered;
  });
  return { alerts: next, newlyTriggered };
}
