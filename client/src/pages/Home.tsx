import { trpc } from "@/lib/trpc";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CandlestickChart,
  ChevronRight,
  Clock3,
  Coins,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { inspectWalletCompatibility, isWalletExtensionConflict, type WalletCompatibility } from "@/lib/walletCompatibility";
import { loadWatchlist, persistToggledWatchlist } from "@/lib/watchlistStorage";
import { createPriceAlert, evaluatePriceAlerts, loadPriceAlerts, savePriceAlerts, type AlertDirection, type PriceAlert } from "@/lib/priceAlerts";
import { loadDashboardPreferences, saveDashboardPreferences } from "@/lib/dashboardPreferences";
import { toast } from "sonner";

const integer = new Intl.NumberFormat("en-US");

const chartRanges = [
  { days: "1", label: "1日" },
  { days: "7", label: "1週" },
  { days: "30", label: "1か月" },
  { days: "365", label: "1年" },
] as const;

type ChartRange = (typeof chartRanges)[number]["days"];
type QuoteCurrency = "usd" | "jpy";
type ChartView = "price" | "volume" | "candle";

function formatPrice(value: number, currency: QuoteCurrency = "usd") {
  const locale = currency === "jpy" ? "ja-JP" : "en-US";
  if (value >= 1) return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: currency === "jpy" ? 0 : 2 }).format(value);
  return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
}

function formatCompact(value: number, currency: QuoteCurrency = "usd") {
  return new Intl.NumberFormat(currency === "jpy" ? "ja-JP" : "en-US", { style: "currency", currency: currency.toUpperCase(), notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function Change({ value, small = false }: { value: number; small?: boolean }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return <span className={`inline-flex items-center gap-1 font-semibold ${positive ? "text-emerald-300" : "text-rose-300"} ${small ? "text-xs" : "text-sm"}`}><Icon className={small ? "h-3.5 w-3.5" : "h-4 w-4"} />{formatChange(value)}</span>;
}

function AssetAvatar({ image, symbol, className = "" }: { image: string; symbol: string; className?: string }) {
  return <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-[10px] font-bold text-slate-300 ${className}`}>
    {image ? <img className="h-full w-full object-cover" src={image} alt="" /> : symbol.slice(0, 2)}
  </span>;
}

function PriceChart({ points, range, currency }: { points: Array<{ timestamp: number; priceUsd: number }>; range: ChartRange; currency: QuoteCurrency }) {
  const chartDomain = useMemo(() => {
    const values = points.map(point => point.priceUsd);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.14, max * 0.005);
    return [Math.max(0, min - padding), max + padding] as [number, number];
  }, [points]);

  const timeLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    return range === "1"
      ? date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  };

  if (!points.length) return <div className="chart-empty">表示できる価格データがありません。</div>;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={points} margin={{ top: 10, right: 8, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id="atlasChartFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f4c86a" stopOpacity={0.32} />
            <stop offset="82%" stopColor="#f4c86a" stopOpacity={0.015} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 6" />
        <XAxis dataKey="timestamp" axisLine={false} tickLine={false} minTickGap={34} tick={{ fill: "#72809a", fontSize: 11 }} tickFormatter={timeLabel} />
        <YAxis domain={chartDomain} axisLine={false} tickLine={false} width={72} tick={{ fill: "#72809a", fontSize: 11 }} tickFormatter={(value: number) => formatCompact(value, currency)} />
        <Tooltip
          cursor={{ stroke: "rgba(244,200,106,0.34)", strokeWidth: 1 }}
          contentStyle={{ background: "rgba(12, 18, 36, 0.96)", border: "1px solid rgba(244,200,106,0.22)", borderRadius: "12px", boxShadow: "0 16px 35px rgba(0,0,0,0.35)" }}
          labelStyle={{ color: "#8c99af", fontSize: "11px", marginBottom: "5px" }}
          itemStyle={{ color: "#f8fafc", fontSize: "13px", fontWeight: 700 }}
          labelFormatter={(value: number) => new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
          formatter={(value: number) => [formatPrice(value, currency), "価格"]}
        />
        <Area type="monotone" dataKey="priceUsd" stroke="#f4c86a" strokeWidth={2.4} fill="url(#atlasChartFill)" activeDot={{ r: 4, fill: "#f7d782", stroke: "#121a31", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function VolumeChart({ points, range, currency }: { points: Array<{ timestamp: number; volumeUsd: number }>; range: ChartRange; currency: QuoteCurrency }) {
  const timeLabel = (timestamp: number) => range === "1" ? new Date(timestamp).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) : new Date(timestamp).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
  if (!points.length) return <div className="chart-empty">表示できる出来高データがありません。</div>;
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={points} margin={{ top: 10, right: 8, left: 2, bottom: 2 }}><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 6" /><XAxis dataKey="timestamp" axisLine={false} tickLine={false} minTickGap={34} tick={{ fill: "#72809a", fontSize: 11 }} tickFormatter={timeLabel} /><YAxis axisLine={false} tickLine={false} width={72} tick={{ fill: "#72809a", fontSize: 11 }} tickFormatter={(value: number) => formatCompact(value, currency)} /><Tooltip cursor={{ fill: "rgba(244,200,106,0.06)" }} contentStyle={{ background: "rgba(12, 18, 36, 0.96)", border: "1px solid rgba(244,200,106,0.22)", borderRadius: "12px" }} formatter={(value: number) => [formatCompact(value, currency), "出来高"]} /><Bar dataKey="volumeUsd" fill="rgba(86, 202, 177, 0.72)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>;
}

function CandleChart({ candles, currency }: { candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number }>; currency: QuoteCurrency }) {
  const domain = useMemo(() => {
    const min = Math.min(...candles.map(candle => candle.low));
    const max = Math.max(...candles.map(candle => candle.high));
    const padding = Math.max((max - min) * 0.12, max * 0.003);
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [candles]);
  if (!candles.length) return <div className="chart-empty">表示できるローソク足データがありません。</div>;
  const y = (value: number) => 18 + ((domain.max - value) / (domain.max - domain.min || 1)) * 238;
  const itemWidth = 100 / candles.length;
  return <div className="candle-chart" role="img" aria-label={`${currency.toUpperCase()}建てのローソク足チャート`}><div className="candle-axis"><span>{formatCompact(domain.max, currency)}</span><span>{formatCompact((domain.max + domain.min) / 2, currency)}</span><span>{formatCompact(domain.min, currency)}</span></div><svg viewBox="0 0 1000 274" preserveAspectRatio="none" className="h-full w-full">{[0, 1, 2].map(line => <line key={line} x1="0" x2="1000" y1={18 + line * 119} y2={18 + line * 119} stroke="rgba(255,255,255,0.07)" strokeDasharray="4 8" />)}{candles.map((candle, index) => { const x = index * itemWidth * 10 + itemWidth * 5; const bullish = candle.close >= candle.open; const color = bullish ? "#64d9ae" : "#fb7185"; const top = y(Math.max(candle.open, candle.close)); const bottom = y(Math.min(candle.open, candle.close)); return <g key={candle.timestamp}><title>{`${new Date(candle.timestamp).toLocaleString("ja-JP")} 始値 ${formatPrice(candle.open, currency)} 高値 ${formatPrice(candle.high, currency)} 安値 ${formatPrice(candle.low, currency)} 終値 ${formatPrice(candle.close, currency)}`}</title><line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1.4" /><rect x={x - Math.max(itemWidth * 2.7, 1.5)} y={top} width={Math.max(itemWidth * 5.4, 3)} height={Math.max(bottom - top, 1.4)} rx="1" fill={color} /></g>; })}</svg><div className="candle-caption">公式OHLCデータ · 終値時刻表示</div></div>;
}

function DetailStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof WalletCards }) {
  return <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500"><Icon className="h-3.5 w-3.5 text-amber-200/80" />{label}</div><p className="text-sm font-medium tabular-nums text-slate-100">{value}</p></div>;
}

function LoadingState() {
  return <div className="space-y-5 animate-pulse"><div className="h-14 rounded-2xl bg-white/[0.06]" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="h-[470px] rounded-3xl bg-white/[0.06]" /><div className="h-[470px] rounded-3xl bg-white/[0.06]" /></div><div className="h-48 rounded-3xl bg-white/[0.06]" /></div>;
}

export default function Home() {
  const utils = trpc.useUtils();
  const [selectedCoinId, setSelectedCoinId] = useState("bitcoin");
  const [range, setRange] = useState<ChartRange>("7");
  const [currency, setCurrency] = useState<QuoteCurrency>("usd");
  const [chartView, setChartView] = useState<ChartView>("price");
  const [search, setSearch] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [walletCompatibility, setWalletCompatibility] = useState<WalletCompatibility | null>(null);
  const [savedWatchlistIds, setSavedWatchlistIds] = useState<string[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [alertDirection, setAlertDirection] = useState<AlertDirection>("above");
  const [alertTarget, setAlertTarget] = useState("");
  const [preferencesReady, setPreferencesReady] = useState(false);
  const overviewQuery = trpc.market.overview.useQuery({ currency }, { refetchInterval: 60_000, staleTime: 50_000, retry: 1, refetchOnWindowFocus: true });
  const refreshMutation = trpc.market.refresh.useMutation({ onSuccess: snapshot => { utils.market.overview.setData({ currency }, snapshot); setManualError(null); }, onError: error => setManualError(error.message) });
  const chartQuery = trpc.market.chart.useQuery({ id: selectedCoinId, days: range, currency }, { staleTime: 25_000, retry: 1, refetchOnWindowFocus: false });

  const data = overviewQuery.data;
  const activeAsset = data?.assets.find(asset => asset.id === selectedCoinId) ?? data?.assets[0];
  const filteredAssets = data?.assets.filter(asset => `${asset.name} ${asset.symbol}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const savedAssets = data?.assets.filter(asset => savedWatchlistIds.includes(asset.id)) ?? [];
  const watchlistAssets = savedWatchlistIds.length > 0 ? savedAssets : filteredAssets;
  const isRefreshing = overviewQuery.isFetching || refreshMutation.isPending;
  const errorMessage = manualError ?? overviewQuery.error?.message;
  const activeAlerts = priceAlerts.filter(alert => alert.coinId === activeAsset?.id && alert.currency === currency);

  useEffect(() => {
    const compatibility = inspectWalletCompatibility(window);
    if (compatibility.status === "conflict") setWalletCompatibility(compatibility);

    const handleExtensionError = (event: ErrorEvent) => {
      if (isWalletExtensionConflict(event)) {
        setWalletCompatibility({ status: "conflict", providerCount: 0, reason: "extension-error" });
      }
    };

    window.addEventListener("error", handleExtensionError, true);
    return () => window.removeEventListener("error", handleExtensionError, true);
  }, []);

  useEffect(() => {
    setSavedWatchlistIds(loadWatchlist(window.localStorage));
  }, []);

  useEffect(() => {
    const preferences = loadDashboardPreferences(window.localStorage);
    setCurrency(preferences.currency);
    setChartView(preferences.chartView);
    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (preferencesReady) saveDashboardPreferences({ currency, chartView }, window.localStorage);
  }, [chartView, currency, preferencesReady]);

  useEffect(() => {
    setPriceAlerts(loadPriceAlerts(window.localStorage));
  }, []);

  useEffect(() => {
    if (!data) return;
    const prices = Object.fromEntries(data.assets.map(asset => [`${asset.id}:${currency}`, asset.priceUsd]));
    setPriceAlerts(current => {
      const result = evaluatePriceAlerts(current, prices, Date.now());
      if (result.newlyTriggered.length === 0) return current;
      savePriceAlerts(result.alerts, window.localStorage);
      result.newlyTriggered.forEach(alert => {
        const asset = data.assets.find(item => item.id === alert.coinId);
        toast.success(`${asset?.symbol ?? alert.coinId.toUpperCase()} の価格アラートが到達しました`, { description: `${alert.direction === "above" ? "上昇" : "下落"}条件: ${formatPrice(alert.target, alert.currency)}` });
      });
      return result.alerts;
    });
  }, [currency, data]);

  const toggleSavedAsset = (coinId: string) => {
    setSavedWatchlistIds(current => persistToggledWatchlist(current, coinId, window.localStorage));
  };

  const addPriceAlert = () => {
    if (!activeAsset) return;
    const target = Number(alertTarget.replace(/,/g, ""));
    if (!Number.isFinite(target) || target <= 0) {
      toast.error("有効な目標価格を入力してください。");
      return;
    }
    const alert = createPriceAlert({ coinId: activeAsset.id, currency, direction: alertDirection, target }, Date.now());
    setPriceAlerts(current => {
      const next = [...current, alert];
      savePriceAlerts(next, window.localStorage);
      return next;
    });
    setAlertTarget("");
    toast.success(`${activeAsset.symbol} の価格アラートを保存しました`);
  };

  const removePriceAlert = (id: string) => {
    setPriceAlerts(current => {
      const next = current.filter(alert => alert.id !== id);
      savePriceAlerts(next, window.localStorage);
      return next;
    });
  };

  const walletHelp = walletCompatibility?.reason === "multiple-providers"
    ? `${walletCompatibility.providerCount}個のウォレットプロバイダーが検出されました。`
    : "ウォレット拡張機能がwindow.ethereumの競合を起こしている可能性があります。";

  return (
    <main className="market-shell min-h-screen text-slate-100">
      <div className="dashboard-glow dashboard-glow-one" /><div className="dashboard-glow dashboard-glow-two" />
      <div className="relative mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_10px_30px_rgba(251,191,36,0.22)]"><CandlestickChart className="h-6 w-6" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">Market intelligence</p><h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">Atlas <span className="font-light text-slate-400">Crypto</span></h1></div></div>
          <div className="flex flex-wrap items-center gap-2"><div className="currency-toggle" role="group" aria-label="表示通貨">{(["usd", "jpy"] as QuoteCurrency[]).map(option => <button type="button" key={option} onClick={() => setCurrency(option)} className={currency === option ? "currency-toggle-active" : ""}>{option.toUpperCase()}</button>)}</div><div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />Live · 60秒更新</div><button type="button" onClick={() => refreshMutation.mutate({ currency })} disabled={isRefreshing} className="refresh-button"><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />{isRefreshing ? "更新中" : "更新"}</button></div>
        </header>

        {overviewQuery.isLoading && !data ? <LoadingState /> : null}
        {errorMessage && !data ? <section className="error-panel" role="alert"><ShieldCheck className="h-5 w-5 text-rose-300" /><div><h2 className="font-semibold text-white">市場データを取得できませんでした</h2><p className="mt-1 text-sm text-slate-400">{errorMessage}</p></div><button type="button" className="refresh-button ml-auto" onClick={() => refreshMutation.mutate({ currency })}>再試行</button></section> : null}
        {walletCompatibility?.status === "conflict" ? <section className="wallet-compatibility" role="status"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div className="min-w-0 flex-1"><p className="font-semibold text-amber-100">ウォレット拡張機能の互換性を確認してください</p><p className="mt-1 text-sm leading-relaxed text-slate-300">{walletHelp} このダッシュボードはウォレットへ接続しません。拡張機能を一つだけ有効にするか、シークレットウィンドウ／別プロファイルで開いてください。</p></div><button type="button" className="compatibility-dismiss" onClick={() => setWalletCompatibility(null)} aria-label="互換性案内を閉じる"><X className="h-4 w-4" /></button></section> : null}

        {data && activeAsset ? <>
          <section className="macro-strip mb-5" aria-label="市場マクロ指標"><div><p>GLOBAL MARKET CAP</p><strong>{formatCompact(data.summary.totalMarketCapUsd, currency)}</strong></div><div><p>24H MARKET MOVE</p><Change value={data.summary.marketCapChange24hPct} small /></div><div><p>BTC DOMINANCE</p><strong>{data.summary.btcDominancePct.toFixed(2)}%</strong></div><div><p>24H VOLUME</p><strong>{formatCompact(data.summary.totalVolumeUsd, currency)}</strong></div><div className="hidden xl:block"><p>COIN UNIVERSE</p><strong>{integer.format(data.summary.activeCryptocurrencies)}</strong></div><span className="ml-auto hidden items-center gap-1.5 text-[11px] text-slate-500 lg:inline-flex"><Clock3 className="h-3.5 w-3.5" />{new Date(data.fetchedAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "medium" })}</span></section>
          {errorMessage ? <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-100">最新の更新に失敗しました。表示中のデータは直近の取得結果です。{errorMessage}</div> : null}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="terminal-panel overflow-hidden">
              <div className="border-b border-white/[0.08] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-3"><AssetAvatar image={activeAsset.image} symbol={activeAsset.symbol} className="h-11 w-11" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{activeAsset.symbol} / {currency.toUpperCase()}</p><h2 className="text-xl font-semibold text-white">{activeAsset.name}</h2></div></div><div className="sm:text-right"><p className="text-2xl font-semibold tracking-tight tabular-nums text-white">{formatPrice(activeAsset.priceUsd, currency)}</p><Change value={activeAsset.change24hPct} /></div></div>
                <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div className="inline-flex w-fit rounded-xl border border-white/[0.08] bg-black/15 p-1" role="tablist" aria-label="チャート期間">{chartRanges.map(option => <button key={option.days} type="button" role="tab" aria-selected={range === option.days} onClick={() => setRange(option.days)} className={`chart-range-button ${range === option.days ? "chart-range-button-active" : ""}`}>{option.label}</button>)}</div><div className="flex items-center justify-between gap-3"><div className="chart-type-toggle" role="group" aria-label="チャート種別">{([['price', '価格'], ['volume', '出来高'], ['candle', '足']] as const).map(([view, label]) => <button type="button" key={view} onClick={() => setChartView(view)} className={chartView === view ? "chart-type-active" : ""}>{label}</button>)}</div><span className="flex items-center gap-2 text-xs text-slate-500">{chartQuery.isFetching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-200" /> : <TrendingUp className="h-3.5 w-3.5 text-amber-200" />}CoinGecko</span></div></div></div>
              <div className="h-[310px] px-2 pb-2 pt-3 sm:h-[390px] sm:px-4">{chartQuery.data ? chartView === "price" ? <PriceChart points={chartQuery.data.points} range={range} currency={currency} /> : chartView === "volume" ? <VolumeChart points={chartQuery.data.points} range={range} currency={currency} /> : chartQuery.data.candleUnavailable ? <div className="chart-empty">ローソク足データは一時的に利用できません。価格・出来高チャートは引き続き利用できます。</div> : <CandleChart candles={chartQuery.data.candles} currency={currency} /> : chartQuery.isLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-200" />価格チャートを読み込み中</div> : <div className="chart-empty">{chartQuery.error?.message ?? "価格チャートを表示できませんでした。"}</div>}</div>
              <div className="grid grid-cols-2 border-t border-white/[0.08] bg-white/[0.018] sm:grid-cols-4"><div className="chart-footer-stat"><span>24h 高値</span><strong>{formatPrice(activeAsset.high24hUsd, currency)}</strong></div><div className="chart-footer-stat"><span>24h 安値</span><strong>{formatPrice(activeAsset.low24hUsd, currency)}</strong></div><div className="chart-footer-stat"><span>7日変化</span><Change value={activeAsset.change7dPct} small /></div><div className="chart-footer-stat"><span>取引量</span><strong>{formatCompact(activeAsset.volume24hUsd, currency)}</strong></div></div>
            </article>

            <aside className="space-y-5">
              <section className="terminal-panel p-5"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Asset profile</p><h2 className="mt-1 text-lg font-semibold text-white">詳細情報</h2></div><button type="button" onClick={() => toggleSavedAsset(activeAsset.id)} className={`icon-button ${savedWatchlistIds.includes(activeAsset.id) ? "icon-button-active" : ""}`} aria-label={savedWatchlistIds.includes(activeAsset.id) ? `${activeAsset.name}をウォッチリストから削除` : `${activeAsset.name}をウォッチリストに追加`}><Star className="h-4 w-4" fill={savedWatchlistIds.includes(activeAsset.id) ? "currentColor" : "none"} /></button></div><div className="grid grid-cols-2 gap-2.5"><DetailStat label="時価総額" value={formatCompact(activeAsset.marketCapUsd, currency)} icon={Landmark} /><DetailStat label="ランキング" value={`#${activeAsset.rank}`} icon={WalletCards} /><DetailStat label="24時間" value={formatChange(activeAsset.change24hPct)} icon={TrendingUp} /><DetailStat label="市場シェア" value={`${((activeAsset.marketCapUsd / data.summary.totalMarketCapUsd) * 100).toFixed(2)}%`} icon={Coins} /></div><div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-300/[0.045] px-3.5 py-3 text-xs leading-relaxed text-slate-400">価格データは公開市場情報です。売買の推奨や投資助言を目的とした表示ではありません。</div></section>

              <section className="terminal-panel p-5"><div className="mb-4"><p className="eyebrow">Price alerts</p><h2 className="mt-1 text-lg font-semibold text-white">価格アラート</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">このブラウザ内で保存され、市場データ更新時に判定されます。</p></div><div className="flex gap-2"><div className="chart-type-toggle"><button type="button" onClick={() => setAlertDirection("above")} className={alertDirection === "above" ? "chart-type-active" : ""}>以上</button><button type="button" onClick={() => setAlertDirection("below")} className={alertDirection === "below" ? "chart-type-active" : ""}>以下</button></div><input value={alertTarget} onChange={event => setAlertTarget(event.target.value)} inputMode="decimal" className="alert-target-input" placeholder={currency === "jpy" ? "例: 13000000" : "例: 100000"} aria-label="目標価格" /></div><button type="button" onClick={addPriceAlert} className="alert-save-button">{alertDirection === "above" ? "上昇" : "下落"}アラートを保存</button><div className="mt-3 space-y-2">{activeAlerts.map(alert => <div className={`price-alert-row ${alert.triggeredAt ? "price-alert-triggered" : ""}`} key={alert.id}><span>{alert.direction === "above" ? "上昇" : "下落"} {formatPrice(alert.target, currency)}{alert.triggeredAt ? " · 到達済み" : ""}</span><button type="button" onClick={() => removePriceAlert(alert.id)} aria-label="価格アラートを削除">解除</button></div>)}{activeAlerts.length === 0 ? <p className="text-xs text-slate-500">この資産・通貨の保存済みアラートはありません。</p> : null}</div></section>

              <section className="terminal-panel overflow-hidden"><div className="border-b border-white/[0.08] px-5 py-4"><div className="flex items-center justify-between"><div><p className="eyebrow">Watchlist</p><h2 className="mt-1 text-lg font-semibold text-white">{savedWatchlistIds.length ? "保存済みウォッチリスト" : "主要資産"}</h2></div><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">{savedWatchlistIds.length ? `${savedAssets.length} 保存済み` : `${data.assets.length} 銘柄`}</span></div>{savedWatchlistIds.length === 0 ? <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} className="watch-search" placeholder="銘柄を検索" aria-label="銘柄を検索" /></label> : <p className="mt-3 text-xs leading-relaxed text-slate-500">星印を押すと、選択中の銘柄をこのブラウザに保存できます。</p>}</div><div className="max-h-[335px] overflow-y-auto p-2">{watchlistAssets.map(asset => <button type="button" key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`watchlist-row ${asset.id === activeAsset.id ? "watchlist-row-active" : ""}`}><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-8 w-8" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-slate-200">{asset.name}</span><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{asset.symbol}</span></span><span className="text-right"><span className="block text-xs font-medium tabular-nums text-slate-200">{formatPrice(asset.priceUsd, currency)}</span><Change value={asset.change24hPct} small /></span><ChevronRight className="h-4 w-4 text-slate-600" /></button>)}{watchlistAssets.length === 0 ? <p className="px-3 py-7 text-center text-sm text-slate-500">保存済み銘柄は現在の上位資産にありません。</p> : null}</div></section>
            </aside>
          </section>

          <section className="terminal-panel mt-5 overflow-hidden"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6"><div><p className="eyebrow">Market board</p><h2 className="mt-1 text-lg font-semibold text-white">マーケットボード</h2></div><p className="hidden text-xs text-slate-500 sm:block">行を選択してチャートを切り替え</p></div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left"><thead className="bg-white/[0.022] text-[10px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-6 py-3.5 font-medium">Rank</th><th className="px-4 py-3.5 font-medium">Asset</th><th className="px-4 py-3.5 text-right font-medium">Price</th><th className="px-4 py-3.5 text-right font-medium">Market cap</th><th className="px-4 py-3.5 text-right font-medium">24h</th><th className="px-6 py-3.5 text-right font-medium">7d</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{data.assets.map(asset => <tr key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`cursor-pointer transition-colors hover:bg-white/[0.035] ${asset.id === activeAsset.id ? "bg-amber-300/[0.045]" : ""}`}><td className="px-6 py-3.5 text-sm tabular-nums text-slate-500">{String(asset.rank).padStart(2, "0")}</td><td className="px-4 py-3.5"><div className="flex items-center gap-3"><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-8 w-8" /><span><span className="block text-sm font-medium text-slate-100">{asset.name}</span><span className="text-[10px] uppercase tracking-wider text-slate-500">{asset.symbol}</span></span></div></td><td className="px-4 py-3.5 text-right text-sm font-medium tabular-nums text-slate-100">{formatPrice(asset.priceUsd, currency)}</td><td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-300">{formatCompact(asset.marketCapUsd, currency)}</td><td className="px-4 py-3.5 text-right"><Change value={asset.change24hPct} small /></td><td className="px-6 py-3.5 text-right"><Change value={asset.change7dPct} small /></td></tr>)}</tbody></table></div><div className="divide-y divide-white/[0.07] md:hidden">{data.assets.map(asset => <button type="button" key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${asset.id === activeAsset.id ? "bg-amber-300/[0.045]" : ""}`}><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-9 w-9" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-100">{asset.name}</span><span className="text-[10px] uppercase tracking-wider text-slate-500">{asset.symbol}</span></span><span className="text-right"><span className="block text-sm font-medium tabular-nums text-slate-100">{formatPrice(asset.priceUsd, currency)}</span><Change value={asset.change24hPct} small /></span></button>)}</div></section>
          <footer className="flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between"><p>CoinGecko Public APIによる市場データ。投資助言または売買推奨ではありません。</p><p>グローバル指標更新: {data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : "—"}</p></footer>
        </> : null}
      </div>
    </main>
  );
}
