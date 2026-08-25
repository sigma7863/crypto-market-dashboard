import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Coins,
  Database,
  Globe2,
  Landmark,
  LoaderCircle,
  RefreshCw,
  Signal,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("en-US");

function formatPrice(value: number) {
  if (value >= 1) return money.format(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(value);
}

function formatChange(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function Change({ value, compact = false }: { value: number; compact?: boolean }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${positive ? "text-emerald-300" : "text-rose-300"} ${compact ? "text-xs" : "text-sm"}`}>
      <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {formatChange(value)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent = "violet",
}: {
  label: string;
  value: string;
  detail: React.ReactNode;
  icon: typeof Landmark;
  accent?: "violet" | "gold" | "teal";
}) {
  return (
    <article className="metric-card">
      <div className="flex items-center justify-between gap-3">
        <p className="metric-label">{label}</p>
        <span className={`metric-icon metric-icon-${accent}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="metric-value">{value}</p>
      <div className="min-h-5 text-sm text-slate-400">{detail}</div>
    </article>
  );
}

function LoadingDashboard() {
  return (
    <div className="space-y-8 animate-pulse" aria-label="市場データを読み込み中">
      <div className="h-24 rounded-3xl bg-white/[0.06]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => <div className="h-40 rounded-2xl bg-white/[0.06]" key={index} />)}
      </div>
      <div className="h-[460px] rounded-3xl bg-white/[0.06]" />
    </div>
  );
}

export default function Home() {
  const utils = trpc.useUtils();
  const [manualError, setManualError] = useState<string | null>(null);
  const marketQuery = trpc.market.overview.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 50_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const refreshMutation = trpc.market.refresh.useMutation({
    onSuccess: snapshot => {
      utils.market.overview.setData(undefined, snapshot);
      setManualError(null);
    },
    onError: error => setManualError(error.message),
  });

  const data = marketQuery.data;
  const errorMessage = manualError ?? marketQuery.error?.message;
  const isRefreshing = marketQuery.isFetching || refreshMutation.isPending;

  return (
    <main className="market-shell min-h-screen text-slate-100">
      <div className="dashboard-glow dashboard-glow-one" />
      <div className="dashboard-glow dashboard-glow-two" />
      <div className="relative mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-yellow-400 to-orange-500 text-slate-950 shadow-[0_10px_30px_rgba(251,191,36,0.25)]">
              <Coins className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/80">Market intelligence</p>
              <h1 className="font-display text-3xl tracking-tight text-white sm:text-4xl">Atlas <span className="font-light text-slate-400">Crypto</span></h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-2 text-xs text-emerald-200">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" /></span>
              60秒ごとに更新
            </div>
            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              disabled={isRefreshing}
              className="refresh-button"
              aria-label="市場データを今すぐ更新"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "更新中" : "今すぐ更新"}</span>
            </button>
          </div>
        </header>

        {marketQuery.isLoading && !data ? <LoadingDashboard /> : null}

        {errorMessage && !data ? (
          <section className="error-panel" role="alert">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300"><Signal className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-semibold text-white">市場データを取得できませんでした</h2>
              <p className="mt-1 text-sm text-slate-400">{errorMessage}</p>
            </div>
            <button type="button" onClick={() => refreshMutation.mutate()} className="refresh-button ml-auto">再試行</button>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Global snapshot</p>
                <h2 className="font-display text-2xl text-white sm:text-3xl">グローバル市場サマリー</h2>
              </div>
              <p className="flex items-center gap-2 text-xs text-slate-400"><Database className="h-3.5 w-3.5 text-amber-300" />最終取得: {new Date(data.fetchedAt).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "medium" })}</p>
            </section>

            {errorMessage ? <div className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-100" role="status">最新の更新に失敗しました。表示中のデータは直近の取得結果です。{errorMessage}</div> : null}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7" aria-label="グローバル市場サマリー">
              <MetricCard label="総時価総額" value={compactMoney.format(data.summary.totalMarketCapUsd)} icon={Landmark} detail={<Change value={data.summary.marketCapChange24hPct} compact />} accent="gold" />
              <MetricCard label="24時間変化" value={formatChange(data.summary.marketCapChange24hPct)} icon={TrendingUp} detail="市場全体の時価総額" />
              <MetricCard label="24時間取引量" value={compactMoney.format(data.summary.totalVolumeUsd)} icon={BarChart3} detail={<><Change value={data.summary.volumeChange24hPct} compact /> 前期間比</>} accent="teal" />
              <MetricCard label="BTC ドミナンス" value={`${data.summary.btcDominancePct.toFixed(2)}%`} icon={Coins} detail="市場全体に占める比率" />
              <MetricCard label="ETH ドミナンス" value={`${data.summary.ethDominancePct.toFixed(2)}%`} icon={Coins} detail="市場全体に占める比率" accent="teal" />
              <MetricCard label="収録資産" value={integer.format(data.summary.activeCryptocurrencies)} icon={Globe2} detail="アクティブな暗号資産" />
              <MetricCard label="市場数" value={integer.format(data.summary.markets)} icon={Signal} detail="CoinGecko収録市場" accent="gold" />
            </section>

            <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/45 shadow-2xl shadow-black/20 backdrop-blur-xl">
              <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div>
                  <p className="eyebrow">Market leaders</p>
                  <h2 className="font-display text-2xl text-white">主要暗号資産</h2>
                </div>
                <p className="text-xs text-slate-400">時価総額上位10資産・USD建て</p>
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[780px] text-left">
                  <thead className="bg-white/[0.025] text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-7 py-4 font-medium">順位</th>
                      <th className="px-4 py-4 font-medium">資産</th>
                      <th className="px-4 py-4 text-right font-medium">価格</th>
                      <th className="px-4 py-4 text-right font-medium">時価総額</th>
                      <th className="px-4 py-4 text-right font-medium">24時間</th>
                      <th className="px-7 py-4 text-right font-medium">7日間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {data.assets.map(asset => (
                      <tr key={asset.id} className="group transition-colors hover:bg-white/[0.035]">
                        <td className="px-7 py-4 text-sm tabular-nums text-slate-500">{String(asset.rank).padStart(2, "0")}</td>
                        <td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-xs font-bold text-slate-300">{asset.image ? <img src={asset.image} alt="" className="h-full w-full object-cover" /> : asset.symbol.slice(0, 2)}</span><div><p className="font-medium text-slate-100">{asset.name}</p><p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">{asset.symbol}</p></div></div></td>
                        <td className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-200">{formatPrice(asset.priceUsd)}</td>
                        <td className="px-4 py-4 text-right text-sm tabular-nums text-slate-300">{compactMoney.format(asset.marketCapUsd)}</td>
                        <td className="px-4 py-4 text-right"><Change value={asset.change24hPct} /></td>
                        <td className="px-7 py-4 text-right"><Change value={asset.change7dPct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/[0.07] sm:hidden">
                {data.assets.map(asset => (
                  <article className="p-4" key={asset.id}>
                    <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-3"><span className="text-xs tabular-nums text-slate-500">#{asset.rank}</span><span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-xs font-bold text-slate-300">{asset.image ? <img src={asset.image} alt="" className="h-full w-full object-cover" /> : asset.symbol.slice(0, 2)}</span><div><p className="font-medium text-slate-100">{asset.name}</p><p className="text-[11px] uppercase tracking-wider text-slate-500">{asset.symbol}</p></div></div><p className="text-sm font-medium tabular-nums text-slate-100">{formatPrice(asset.priceUsd)}</p></div>
                    <div className="grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-3 text-xs"><div><p className="mb-1 text-slate-500">時価総額</p><p className="tabular-nums text-slate-300">{compactMoney.format(asset.marketCapUsd)}</p></div><div><p className="mb-1 text-slate-500">24時間</p><Change value={asset.change24hPct} compact /></div><div><p className="mb-1 text-slate-500">7日間</p><Change value={asset.change7dPct} compact /></div></div>
                  </article>
                ))}
              </div>
            </section>

            <footer className="flex flex-col gap-3 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>CoinGecko Public APIによる市場データ。投資助言または売買推奨ではありません。</p>
              <p>グローバル指標の提供元更新: {data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" }) : "—"}</p>
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}
