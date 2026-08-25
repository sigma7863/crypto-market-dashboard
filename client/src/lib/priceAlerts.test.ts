import { describe, expect, it } from "vitest";
import { createPriceAlert, evaluatePriceAlerts, loadPriceAlerts, PRICE_ALERT_STORAGE_KEY, savePriceAlerts } from "./priceAlerts";

function createStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) };
}

describe("price alerts", () => {
  it("creates a target alert with a stable local identifier", () => {
    expect(createPriceAlert({ coinId: "bitcoin", currency: "usd", direction: "above", target: 100000 }, 123)).toMatchObject({
      id: "bitcoin-usd-above-100000-123", createdAt: 123,
    });
  });

  it("triggers matching above and below alerts only once", () => {
    const above = createPriceAlert({ coinId: "bitcoin", currency: "usd", direction: "above", target: 100 }, 1);
    const below = createPriceAlert({ coinId: "ethereum", currency: "jpy", direction: "below", target: 400000 }, 1);
    const result = evaluatePriceAlerts([above, below], { "bitcoin:usd": 101, "ethereum:jpy": 399000 }, 2);
    expect(result.newlyTriggered).toHaveLength(2);
    expect(evaluatePriceAlerts(result.alerts, { "bitcoin:usd": 102, "ethereum:jpy": 398000 }, 3).newlyTriggered).toEqual([]);
  });

  it("persists valid alerts and ignores malformed storage content", () => {
    const storage = createStorage();
    const alert = createPriceAlert({ coinId: "solana", currency: "jpy", direction: "above", target: 20000 }, 1);
    savePriceAlerts([alert], storage);
    expect(loadPriceAlerts(storage)).toEqual([alert]);
    expect(loadPriceAlerts(createStorage({ [PRICE_ALERT_STORAGE_KEY]: "bad-json" }))).toEqual([]);
  });
});
