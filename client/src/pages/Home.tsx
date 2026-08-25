import { trpc } from "@/lib/trpc";
import {
  Area,
  AreaChart,
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

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-US");

const chartRanges = [
  { days: "1", label: "1日" },
  { days: "7", label: "1週" },
  { days: "30", label: "1か月" },
  { days: "365", label: "1年" },
] as const;

type ChartRange = (typeof chartRanges)[number]["days"];

function formatPrice(value: number) {
  if (value >= 1) return money.format(value);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(value);
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

function PriceChart({ points, range }: { points: Array<{ timestamp: number; priceUsd: number }>; range: ChartRange }) {
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
        <YAxis domain={chartDomain} axisLine={false} tickLine={false} width={62} tick={{ fill: "#72809a", fontSize: 11 }} tickFormatter={(value: number) => compactMoney.format(value)} />
        <Tooltip
          cursor={{ stroke: "rgba(244,200,106,0.34)", strokeWidth: 1 }}
          contentStyle={{ background: "rgba(12, 18, 36, 0.96)", border: "1px solid rgba(244,200,106,0.22)", borderRadius: "12px", boxShadow: "0 16px 35px rgba(0,0,0,0.35)" }}
          labelStyle={{ color: "#8c99af", fontSize: "11px", marginBottom: "5px" }}
          itemStyle={{ color: "#f8fafc", fontSize: "13px", fontWeight: 700 }}
          labelFormatter={(value: number) => new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" })}
          formatter={(value: number) => [formatPrice(value), "価格"]}
        />
        <Area type="monotone" dataKey="priceUsd" stroke="#f4c86a" strokeWidth={2.4} fill="url(#atlasChartFill)" activeDot={{ r: 4, fill: "#f7d782", stroke: "#121a31", strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
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
  const [search, setSearch] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [walletCompatibility, setWalletCompatibility] = useState<WalletCompatibility | null>(null);
  const [savedWatchlistIds, setSavedWatchlistIds] = useState<string[]>([]);
  const overviewQuery = trpc.market.overview.useQuery(undefined, { refetchInterval: 60_000, staleTime: 50_000, retry: 1, refetchOnWindowFocus: true });
  const refreshMutation = trpc.market.refresh.useMutation({ onSuccess: snapshot => { utils.market.overview.setData(undefined, snapshot); setManualError(null); }, onError: error => setManualError(error.message) });
  const chartQuery = trpc.market.chart.useQuery({ id: selectedCoinId, days: range }, { staleTime: 25_000, retry: 1, refetchOnWindowFocus: false });

  const data = overviewQuery.data;
  const activeAsset = data?.assets.find(asset => asset.id === selectedCoinId) ?? data?.assets[0];
  const filteredAssets = data?.assets.filter(asset => `${asset.name} ${asset.symbol}`.toLowerCase().includes(search.trim().toLowerCase())) ?? [];
  const savedAssets = data?.assets.filter(asset => savedWatchlistIds.includes(asset.id)) ?? [];
  const watchlistAssets = savedWatchlistIds.length > 0 ? savedAssets : filteredAssets;
  const isRefreshing = overviewQuery.isFetching || refreshMutation.isPending;
  const errorMessage = manualError ?? overviewQuery.error?.message;

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

  const toggleSavedAsset = (coinId: string) => {
    setSavedWatchlistIds(current => persistToggledWatchlist(current, coinId, window.localStorage));
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
          <div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-xs text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />Live · 60秒更新</div><button type="button" onClick={() => refreshMutation.mutate()} disabled={isRefreshing} className="refresh-button"><RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />{isRefreshing ? "更新中" : "更新"}</button></div>
        </header>

        {overviewQuery.isLoading && !data ? <LoadingState /> : null}
        {errorMessage && !data ? <section className="error-panel" role="alert"><ShieldCheck className="h-5 w-5 text-rose-300" /><div><h2 className="font-semibold text-white">市場データを取得できませんでした</h2><p className="mt-1 text-sm text-slate-400">{errorMessage}</p></div><button type="button" className="refresh-button ml-auto" onClick={() => refreshMutation.mutate()}>再試行</button></section> : null}
        {walletCompatibility?.status === "conflict" ? <section className="wallet-compatibility" role="status"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div className="min-w-0 flex-1"><p className="font-semibold text-amber-100">ウォレット拡張機能の互換性を確認してください</p><p className="mt-1 text-sm leading-relaxed text-slate-300">{walletHelp} このダッシュボードはウォレットへ接続しません。拡張機能を一つだけ有効にするか、シークレットウィンドウ／別プロファイルで開いてください。</p></div><button type="button" className="compatibility-dismiss" onClick={() => setWalletCompatibility(null)} aria-label="互換性案内を閉じる"><X className="h-4 w-4" /></button></section> : null}

        {data && activeAsset ? <>
          <section className="macro-strip mb-5" aria-label="市場マクロ指標"><div><p>GLOBAL MARKET CAP</p><strong>{compactMoney.format(data.summary.totalMarketCapUsd)}</strong></div><div><p>24H MARKET MOVE</p><Change value={data.summary.marketCapChange24hPct} small /></div><div><p>BTC DOMINANCE</p><strong>{data.summary.btcDominancePct.toFixed(2)}%</strong></div><div><p>24H VOLUME</p><strong>{compactMoney.format(data.summary.totalVolumeUsd)}</strong></div><div className="hidden xl:block"><p>COIN UNIVERSE</p><strong>{integer.format(data.summary.activeCryptocurrencies)}</strong></div><span className="ml-auto hidden items-center gap-1.5 text-[11px] text-slate-500 lg:inline-flex"><Clock3 className="h-3.5 w-3.5" />{new Date(data.fetchedAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "medium" })}</span></section>
          {errorMessage ? <div className="mb-4 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-100">最新の更新に失敗しました。表示中のデータは直近の取得結果です。{errorMessage}</div> : null}

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article className="terminal-panel overflow-hidden">
              <div className="border-b border-white/[0.08] px-5 pb-4 pt-5 sm:px-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-3"><AssetAvatar image={activeAsset.image} symbol={activeAsset.symbol} className="h-11 w-11" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{activeAsset.symbol} / USD</p><h2 className="text-xl font-semibold text-white">{activeAsset.name}</h2></div></div><div className="sm:text-right"><p className="text-2xl font-semibold tracking-tight tabular-nums text-white">{formatPrice(activeAsset.priceUsd)}</p><Change value={activeAsset.change24hPct} /></div></div>
                <div className="mt-5 flex items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-white/[0.08] bg-black/15 p-1" role="tablist" aria-label="チャート期間">{chartRanges.map(option => <button key={option.days} type="button" role="tab" aria-selected={range === option.days} onClick={() => setRange(option.days)} className={`chart-range-button ${range === option.days ? "chart-range-button-active" : ""}`}>{option.label}</button>)}</div><span className="flex items-center gap-2 text-xs text-slate-500">{chartQuery.isFetching ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-amber-200" /> : <TrendingUp className="h-3.5 w-3.5 text-amber-200" />}CoinGecko chart</span></div></div>
              <div className="h-[310px] px-2 pb-2 pt-3 sm:h-[390px] sm:px-4">{chartQuery.data ? <PriceChart points={chartQuery.data.points} range={range} /> : chartQuery.isLoading ? <div className="flex h-full items-center justify-center text-sm text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-200" />価格チャートを読み込み中</div> : <div className="chart-empty">{chartQuery.error?.message ?? "価格チャートを表示できませんでした。"}</div>}</div>
              <div className="grid grid-cols-2 border-t border-white/[0.08] bg-white/[0.018] sm:grid-cols-4"><div className="chart-footer-stat"><span>24h 高値</span><strong>{formatPrice(activeAsset.high24hUsd)}</strong></div><div className="chart-footer-stat"><span>24h 安値</span><strong>{formatPrice(activeAsset.low24hUsd)}</strong></div><div className="chart-footer-stat"><span>7日変化</span><Change value={activeAsset.change7dPct} small /></div><div className="chart-footer-stat"><span>取引量</span><strong>{compactMoney.format(activeAsset.volume24hUsd)}</strong></div></div>
            </article>

            <aside className="space-y-5">
              <section className="terminal-panel p-5"><div className="mb-5 flex items-center justify-between"><div><p className="eyebrow">Asset profile</p><h2 className="mt-1 text-lg font-semibold text-white">詳細情報</h2></div><button type="button" onClick={() => toggleSavedAsset(activeAsset.id)} className={`icon-button ${savedWatchlistIds.includes(activeAsset.id) ? "icon-button-active" : ""}`} aria-label={savedWatchlistIds.includes(activeAsset.id) ? `${activeAsset.name}をウォッチリストから削除` : `${activeAsset.name}をウォッチリストに追加`}><Star className="h-4 w-4" fill={savedWatchlistIds.includes(activeAsset.id) ? "currentColor" : "none"} /></button></div><div className="grid grid-cols-2 gap-2.5"><DetailStat label="時価総額" value={compactMoney.format(activeAsset.marketCapUsd)} icon={Landmark} /><DetailStat label="ランキング" value={`#${activeAsset.rank}`} icon={WalletCards} /><DetailStat label="24時間" value={formatChange(activeAsset.change24hPct)} icon={TrendingUp} /><DetailStat label="市場シェア" value={`${((activeAsset.marketCapUsd / data.summary.totalMarketCapUsd) * 100).toFixed(2)}%`} icon={Coins} /></div><div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-300/[0.045] px-3.5 py-3 text-xs leading-relaxed text-slate-400">価格データは公開市場情報です。売買の推奨や投資助言を目的とした表示ではありません。</div></section>

              <section className="terminal-panel overflow-hidden"><div className="border-b border-white/[0.08] px-5 py-4"><div className="flex items-center justify-between"><div><p className="eyebrow">Watchlist</p><h2 className="mt-1 text-lg font-semibold text-white">{savedWatchlistIds.length ? "保存済みウォッチリスト" : "主要資産"}</h2></div><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-slate-400">{savedWatchlistIds.length ? `${savedAssets.length} 保存済み` : `${data.assets.length} 銘柄`}</span></div>{savedWatchlistIds.length === 0 ? <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} className="watch-search" placeholder="銘柄を検索" aria-label="銘柄を検索" /></label> : <p className="mt-3 text-xs leading-relaxed text-slate-500">星印を押すと、選択中の銘柄をこのブラウザに保存できます。</p>}</div><div className="max-h-[335px] overflow-y-auto p-2">{watchlistAssets.map(asset => <button type="button" key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`watchlist-row ${asset.id === activeAsset.id ? "watchlist-row-active" : ""}`}><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-8 w-8" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium text-slate-200">{asset.name}</span><span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{asset.symbol}</span></span><span className="text-right"><span className="block text-xs font-medium tabular-nums text-slate-200">{formatPrice(asset.priceUsd)}</span><Change value={asset.change24hPct} small /></span><ChevronRight className="h-4 w-4 text-slate-600" /></button>)}{watchlistAssets.length === 0 ? <p className="px-3 py-7 text-center text-sm text-slate-500">保存済み銘柄は現在の上位資産にありません。</p> : null}</div></section>
            </aside>
          </section>

          <section className="terminal-panel mt-5 overflow-hidden"><div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6"><div><p className="eyebrow">Market board</p><h2 className="mt-1 text-lg font-semibold text-white">マーケットボード</h2></div><p className="hidden text-xs text-slate-500 sm:block">行を選択してチャートを切り替え</p></div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-left"><thead className="bg-white/[0.022] text-[10px] uppercase tracking-[0.14em] text-slate-500"><tr><th className="px-6 py-3.5 font-medium">Rank</th><th className="px-4 py-3.5 font-medium">Asset</th><th className="px-4 py-3.5 text-right font-medium">Price</th><th className="px-4 py-3.5 text-right font-medium">Market cap</th><th className="px-4 py-3.5 text-right font-medium">24h</th><th className="px-6 py-3.5 text-right font-medium">7d</th></tr></thead><tbody className="divide-y divide-white/[0.07]">{data.assets.map(asset => <tr key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`cursor-pointer transition-colors hover:bg-white/[0.035] ${asset.id === activeAsset.id ? "bg-amber-300/[0.045]" : ""}`}><td className="px-6 py-3.5 text-sm tabular-nums text-slate-500">{String(asset.rank).padStart(2, "0")}</td><td className="px-4 py-3.5"><div className="flex items-center gap-3"><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-8 w-8" /><span><span className="block text-sm font-medium text-slate-100">{asset.name}</span><span className="text-[10px] uppercase tracking-wider text-slate-500">{asset.symbol}</span></span></div></td><td className="px-4 py-3.5 text-right text-sm font-medium tabular-nums text-slate-100">{formatPrice(asset.priceUsd)}</td><td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-300">{compactMoney.format(asset.marketCapUsd)}</td><td className="px-4 py-3.5 text-right"><Change value={asset.change24hPct} small /></td><td className="px-6 py-3.5 text-right"><Change value={asset.change7dPct} small /></td></tr>)}</tbody></table></div><div className="divide-y divide-white/[0.07] md:hidden">{data.assets.map(asset => <button type="button" key={asset.id} onClick={() => setSelectedCoinId(asset.id)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${asset.id === activeAsset.id ? "bg-amber-300/[0.045]" : ""}`}><AssetAvatar image={asset.image} symbol={asset.symbol} className="h-9 w-9" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-100">{asset.name}</span><span className="text-[10px] uppercase tracking-wider text-slate-500">{asset.symbol}</span></span><span className="text-right"><span className="block text-sm font-medium tabular-nums text-slate-100">{formatPrice(asset.priceUsd)}</span><Change value={asset.change24hPct} small /></span></button>)}</div></section>
          <footer className="flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between"><p>CoinGecko Public APIによる市場データ。投資助言または売買推奨ではありません。</p><p>グローバル指標更新: {data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : "—"}</p></footer>
        </> : null}
      </div>
    </main>
  );
}
