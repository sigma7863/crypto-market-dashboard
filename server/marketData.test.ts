import { describe, expect, it, vi } from "vitest";
import { createMarketDataService } from "./marketData";

describe("market data service", () => {
  it("normalizes global metrics and market leaders from CoinGecko responses", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      if (String(url).endsWith("/global")) {
        return new Response(JSON.stringify({
          data: {
            active_cryptocurrencies: 12345,
            markets: 999,
            total_market_cap: { usd: 2_500_000_000_000 },
            total_volume: { usd: 120_000_000_000 },
            market_cap_percentage: { btc: 58.2, eth: 11.4 },
            market_cap_change_percentage_24h_usd: 1.25,
            volume_change_percentage_24h_usd: -3.5,
            updated_at: 1_700_000_000,
          },
        }), { status: 200 });
      }

      return new Response(JSON.stringify([{
        id: "bitcoin",
        symbol: "btc",
        name: "Bitcoin",
        image: "https://example.test/btc.png",
        market_cap_rank: 1,
        current_price: 100000,
        market_cap: 2_000_000_000_000,
        price_change_percentage_24h: 2.4,
        price_change_percentage_7d_in_currency: 5.8,
      }]), { status: 200 });
    }) as unknown as typeof fetch;

    const service = createMarketDataService({
      apiKey: "demo-key",
      fetchImpl,
      now: () => 1_700_000_123_000,
    });
    const result = await service.getSnapshot();

    expect(result.summary).toMatchObject({
      totalMarketCapUsd: 2_500_000_000_000,
      totalVolumeUsd: 120_000_000_000,
      btcDominancePct: 58.2,
      ethDominancePct: 11.4,
      activeCryptocurrencies: 12345,
      markets: 999,
    });
    expect(result.assets).toEqual([expect.objectContaining({
      name: "Bitcoin",
      symbol: "BTC",
      change7dPct: 5.8,
    })]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/global"), expect.objectContaining({
      headers: expect.objectContaining({ "x-cg-demo-api-key": "demo-key" }),
    }));
  });

  it("uses a recent cached snapshot unless a refresh is forced", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => new Response(JSON.stringify(
      String(url).endsWith("/global")
        ? { data: { total_market_cap: { usd: 1 }, total_volume: { usd: 1 }, market_cap_percentage: {} } }
        : [],
    ), { status: 200 })) as unknown as typeof fetch;
    const service = createMarketDataService({ fetchImpl, cacheTtlMs: 60_000, now: () => 1_000 });

    await service.getSnapshot();
    await service.getSnapshot();
    await service.getSnapshot(true);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("reports a clear error when CoinGecko rejects a request", async () => {
    const fetchImpl = vi.fn(async () => new Response("Too many requests", { status: 429 })) as unknown as typeof fetch;
    const service = createMarketDataService({ fetchImpl });

    await expect(service.getSnapshot()).rejects.toThrow("リクエスト上限に達しました。");
  });

  it("returns timestamped price series for a selected asset chart", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      prices: [[1_700_000_000_000, 100], [1_700_000_300_000, 105]],
      market_caps: [[1_700_000_000_000, 2_000], [1_700_000_300_000, 2_100]],
      total_volumes: [[1_700_000_000_000, 500], [1_700_000_300_000, 510]],
    }), { status: 200 })) as unknown as typeof fetch;
    const service = createMarketDataService({ fetchImpl, now: () => 1_700_000_400_000 });

    const chart = await service.getChart("bitcoin", "7");

    expect(chart).toMatchObject({ coinId: "bitcoin", days: "7", fetchedAt: 1_700_000_400_000 });
    expect(chart.points).toEqual([
      { timestamp: 1_700_000_000_000, priceUsd: 100, marketCapUsd: 2_000, volumeUsd: 500 },
      { timestamp: 1_700_000_300_000, priceUsd: 105, marketCapUsd: 2_100, volumeUsd: 510 },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("/coins/bitcoin/market_chart?vs_currency=usd&days=7"), expect.any(Object));
  });
});
