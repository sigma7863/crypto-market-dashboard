export type MarketSummary = {
  totalMarketCapUsd: number;
  marketCapChange24hPct: number;
  totalVolumeUsd: number;
  volumeChange24hPct: number;
  btcDominancePct: number;
  ethDominancePct: number;
  activeCryptocurrencies: number;
  markets: number;
};

export type MarketAsset = {
  id: string;
  rank: number;
  name: string;
  symbol: string;
  image: string;
  priceUsd: number;
  marketCapUsd: number;
  volume24hUsd: number;
  high24hUsd: number;
  low24hUsd: number;
  change24hPct: number;
  change7dPct: number;
};

export type ChartRange = "1" | "7" | "30" | "365";

export type MarketChartPoint = {
  timestamp: number;
  priceUsd: number;
  marketCapUsd: number;
  volumeUsd: number;
};

export type MarketChart = {
  coinId: string;
  days: ChartRange;
  points: MarketChartPoint[];
  fetchedAt: number;
};

export type MarketSnapshot = {
  summary: MarketSummary;
  assets: MarketAsset[];
  sourceUpdatedAt: number;
  fetchedAt: number;
};

type GlobalResponse = {
  data: {
    active_cryptocurrencies?: number;
    markets?: number;
    total_market_cap?: Record<string, number>;
    total_volume?: Record<string, number>;
    market_cap_percentage?: Record<string, number>;
    market_cap_change_percentage_24h_usd?: number;
    volume_change_percentage_24h_usd?: number;
    updated_at?: number;
  };
};

type CoinMarketResponse = {
  id?: string;
  symbol?: string;
  name?: string;
  image?: string;
  market_cap_rank?: number;
  current_price?: number;
  market_cap?: number;
  total_volume?: number;
  high_24h?: number;
  low_24h?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
};

type CoinMarketChartResponse = {
  prices?: Array<[number, number]>;
  market_caps?: Array<[number, number]>;
  total_volumes?: Array<[number, number]>;
};

type FetchLike = typeof fetch;

type MarketDataServiceOptions = {
  apiKey?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  fetchImpl?: FetchLike;
  now?: () => number;
};

type CacheEntry = {
  expiresAt: number;
  snapshot: MarketSnapshot;
};

type ChartCacheEntry = {
  expiresAt: number;
  chart: MarketChart;
};

const DEFAULT_BASE_URL = "https://api.coingecko.com/api/v3";
const DEFAULT_CACHE_TTL_MS = 45_000;

export class MarketDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketDataError";
  }
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function requestJson<T>(
  fetchImpl: FetchLike,
  url: string,
  apiKey?: string,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-cg-demo-api-key"] = apiKey;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new MarketDataError("CoinGeckoへの接続に失敗しました。");
  }

  if (!response.ok) {
    const detail = response.status === 429 ? "リクエスト上限に達しました。" : "市場データを取得できませんでした。";
    throw new MarketDataError(detail);
  }

  return (await response.json()) as T;
}

export function createMarketDataService(options: MarketDataServiceOptions = {}) {
  const baseUrl = (options.baseUrl ?? process.env.COINGECKO_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const apiKey = options.apiKey ?? process.env.COINGECKO_DEMO_API_KEY;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  let cache: CacheEntry | undefined;
  const chartCache = new Map<string, ChartCacheEntry>();

  async function getSnapshot(force = false): Promise<MarketSnapshot> {
    if (!force && cache && cache.expiresAt > now()) return cache.snapshot;

    const marketsUrl = new URL(`${baseUrl}/coins/markets`);
    marketsUrl.search = new URLSearchParams({
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: "10",
      page: "1",
      price_change_percentage: "24h,7d",
      locale: "en",
    }).toString();

    const [global, markets] = await Promise.all([
      requestJson<GlobalResponse>(fetchImpl, `${baseUrl}/global`, apiKey),
      requestJson<CoinMarketResponse[]>(fetchImpl, marketsUrl.toString(), apiKey),
    ]);

    if (!global.data || !Array.isArray(markets)) {
      throw new MarketDataError("市場データの形式を確認できませんでした。");
    }

    const snapshot: MarketSnapshot = {
      summary: {
        totalMarketCapUsd: asNumber(global.data.total_market_cap?.usd),
        marketCapChange24hPct: asNumber(global.data.market_cap_change_percentage_24h_usd),
        totalVolumeUsd: asNumber(global.data.total_volume?.usd),
        volumeChange24hPct: asNumber(global.data.volume_change_percentage_24h_usd),
        btcDominancePct: asNumber(global.data.market_cap_percentage?.btc),
        ethDominancePct: asNumber(global.data.market_cap_percentage?.eth),
        activeCryptocurrencies: asNumber(global.data.active_cryptocurrencies),
        markets: asNumber(global.data.markets),
      },
      assets: markets.map((asset, index) => ({
        id: asset.id ?? `asset-${index}`,
        rank: asNumber(asset.market_cap_rank) || index + 1,
        name: asset.name ?? "Unknown asset",
        symbol: (asset.symbol ?? "—").toUpperCase(),
        image: asset.image ?? "",
        priceUsd: asNumber(asset.current_price),
        marketCapUsd: asNumber(asset.market_cap),
        volume24hUsd: asNumber(asset.total_volume),
        high24hUsd: asNumber(asset.high_24h),
        low24hUsd: asNumber(asset.low_24h),
        change24hPct: asNumber(asset.price_change_percentage_24h),
        change7dPct: asNumber(asset.price_change_percentage_7d_in_currency),
      })),
      sourceUpdatedAt: asNumber(global.data.updated_at) * 1000,
      fetchedAt: now(),
    };

    cache = { snapshot, expiresAt: now() + cacheTtlMs };
    return snapshot;
  }

  async function getChart(coinId: string, days: ChartRange): Promise<MarketChart> {
    if (!/^[a-z0-9-]+$/.test(coinId)) {
      throw new MarketDataError("指定された資産IDは利用できません。");
    }

    const cacheKey = `${coinId}:${days}`;
    const cached = chartCache.get(cacheKey);
    if (cached && cached.expiresAt > now()) return cached.chart;

    const chartUrl = new URL(`${baseUrl}/coins/${encodeURIComponent(coinId)}/market_chart`);
    chartUrl.search = new URLSearchParams({ vs_currency: "usd", days }).toString();
    const raw = await requestJson<CoinMarketChartResponse>(fetchImpl, chartUrl.toString(), apiKey);
    if (!Array.isArray(raw.prices)) {
      throw new MarketDataError("価格チャートの形式を確認できませんでした。");
    }

    const capsByTimestamp = new Map((raw.market_caps ?? []).map(([timestamp, value]) => [timestamp, value]));
    const volumesByTimestamp = new Map((raw.total_volumes ?? []).map(([timestamp, value]) => [timestamp, value]));
    const points = raw.prices
      .map(([timestamp, value]) => ({
        timestamp: asNumber(timestamp),
        priceUsd: asNumber(value),
        marketCapUsd: asNumber(capsByTimestamp.get(timestamp)),
        volumeUsd: asNumber(volumesByTimestamp.get(timestamp)),
      }))
      .filter(point => point.timestamp > 0 && point.priceUsd > 0);

    if (points.length === 0) {
      throw new MarketDataError("表示できる価格チャートがありません。");
    }

    const chart: MarketChart = { coinId, days, points, fetchedAt: now() };
    chartCache.set(cacheKey, { chart, expiresAt: now() + 30_000 });
    return chart;
  }

  return { getSnapshot, getChart };
}

export const marketDataService = createMarketDataService();
