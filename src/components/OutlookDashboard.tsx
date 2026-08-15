"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OutlookSignalDto } from "@/lib/api/outlook";
import { ResearchBrief } from "@/components/ResearchBrief";
import { ResearchChat } from "@/components/ResearchChat";
import { PriceChart } from "@/components/PriceChart";
import { SignalQuality } from "@/components/SignalQuality";
import { AlertsPanel } from "@/components/AlertsPanel";
import { EventsPanel } from "@/components/EventsPanel";
import { EventImpactPanel } from "@/components/EventImpactPanel";
import { MacroSparklineStrip } from "@/components/MacroSparklineStrip";
import { NearTermBiasPanel } from "@/components/NearTermBiasPanel";
import type { MacroStrip } from "@/lib/macro/sparklines";
import type { NearTermBias } from "@/lib/risk/near-term";

type User = { id: string; email: string };

type Asset = {
  symbol: string;
  name: string;
  assetClass: string;
  countryCode: string;
  currency: string;
};

type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  asOfUnix: number | null;
  source: "finnhub" | "yahoo";
};

type AssetClass = "watchlist" | "all" | "equity" | "fx" | "commodity" | "rates";

const HORIZONS = ["1d", "1w", "1m"] as const;
const ASSET_CLASSES: { value: AssetClass; label: string }[] = [
  { value: "watchlist", label: "Watchlist" },
  { value: "all", label: "All markets" },
  { value: "equity", label: "Equity" },
  { value: "fx", label: "FX" },
  { value: "commodity", label: "Commodity" },
  { value: "rates", label: "Rates" },
];

function formatDate(date: string | null): string {
  if (!date) return "No signal date";
  const [year, month, day] = date.split("-");
  const monthName = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][Number(month) - 1];

  if (!year || !monthName || !day) return date;
  return `${day} ${monthName} ${year}`;
}

function formatScore(score: number): string {
  return `${score >= 0 ? "+" : ""}${score.toFixed(2)}`;
}

function formatConfidence(value: number | null): string {
  if (value === null) return "N/A";
  return `${Math.round(value * 100)}%`;
}

function formatPrice(price: number, currency: string): string {
  if (currency === "JPY") {
    return new Intl.NumberFormat("en", {
      maximumFractionDigits: 2,
    }).format(price);
  }
  return new Intl.NumberFormat("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function shortName(asset: Asset): string {
  return asset.name.replace(/\s+\([A-Z]+\)$/, "");
}

function directionLabel(direction: string): string {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

export function OutlookDashboard({
  user,
  assets,
  initialSignals,
  initialWatchlist = [],
  initialMacroStrip = null,
  initialNearTermBias = null,
}: {
  user: User | null;
  assets: Asset[];
  initialSignals: OutlookSignalDto[];
  initialWatchlist?: string[];
  initialMacroStrip?: MacroStrip | null;
  initialNearTermBias?: NearTermBias | null;
}) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<User | null>(user);
  const [horizon, setHorizon] = useState<string>("1d");
  const [watchlist, setWatchlist] = useState<string[]>(initialWatchlist);
  const [assetClass, setAssetClass] = useState<AssetClass>(() =>
    user && initialWatchlist.length > 0 ? "watchlist" : "all",
  );
  const [watchBusy, setWatchBusy] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState(() => {
    if (user && initialWatchlist.length > 0) {
      return (
        initialWatchlist.find((symbol) =>
          initialSignals.some(
            (signal) => signal.symbol === symbol && signal.horizon === "1d",
          ),
        ) ??
        initialWatchlist[0] ??
        ""
      );
    }
    return (
      initialSignals.find((signal) => signal.symbol === "SPY")?.symbol ??
      assets[0]?.symbol ??
      ""
    );
  });
  const [quoteResult, setQuoteResult] = useState<{
    symbol: string;
    quote: Quote | null;
    state: "ready" | "unavailable";
  } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setSessionUser(user);
  }, [user]);

  const watchSet = useMemo(() => new Set(watchlist), [watchlist]);

  const signalMap = useMemo(() => {
    const map = new Map<string, OutlookSignalDto>();
    for (const signal of initialSignals) {
      map.set(`${signal.symbol}:${signal.horizon}`, signal);
    }
    return map;
  }, [initialSignals]);

  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (!signalMap.has(`${asset.symbol}:${horizon}`)) return false;
        if (assetClass === "watchlist") return watchSet.has(asset.symbol);
        if (assetClass === "all") return true;
        return asset.assetClass === assetClass;
      }),
    [assetClass, assets, horizon, signalMap, watchSet],
  );

  async function toggleWatch(symbol: string) {
    if (!sessionUser) {
      router.push("/login");
      return;
    }
    if (watchBusy) return;

    const watched = watchSet.has(symbol);
    const previous = watchlist;
    const optimistic = watched
      ? previous.filter((item) => item !== symbol)
      : [...previous, symbol];
    setWatchlist(optimistic);
    setWatchBusy(symbol);

    try {
      const response = await fetch(
        watched
          ? `/api/watchlist?symbol=${encodeURIComponent(symbol)}`
          : "/api/watchlist",
        {
          method: watched ? "DELETE" : "POST",
          headers: watched ? undefined : { "Content-Type": "application/json" },
          body: watched ? undefined : JSON.stringify({ symbol }),
        },
      );
      if (!response.ok) {
        throw new Error("Watchlist update failed");
      }
      const data = (await response.json()) as { symbols: string[] };
      setWatchlist(data.symbols);
    } catch {
      setWatchlist(previous);
    } finally {
      setWatchBusy(null);
    }
  }

  const currentSignals = useMemo(
    () =>
      visibleAssets
        .map((asset) => signalMap.get(`${asset.symbol}:${horizon}`))
        .filter((signal): signal is OutlookSignalDto => Boolean(signal)),
    [horizon, signalMap, visibleAssets],
  );

  const effectiveSelectedSymbol = visibleAssets.some(
    (asset) => asset.symbol === selectedSymbol,
  )
    ? selectedSymbol
    : (visibleAssets[0]?.symbol ?? selectedSymbol);
  const selectedAsset =
    assets.find((asset) => asset.symbol === effectiveSelectedSymbol) ??
    assets[0];
  const selectedSignal =
    signalMap.get(`${effectiveSelectedSymbol}:${horizon}`) ?? null;
  const selectedHorizons = HORIZONS.map((item) => ({
    horizon: item,
    signal: signalMap.get(`${effectiveSelectedSymbol}:${item}`) ?? null,
  }));
  const quote =
    quoteResult?.symbol === effectiveSelectedSymbol ? quoteResult.quote : null;
  const quoteState =
    quoteResult?.symbol === effectiveSelectedSymbol
      ? quoteResult.state
      : "loading";

  const counts = {
    bullish: currentSignals.filter((signal) => signal.direction === "bullish")
      .length,
    neutral: currentSignals.filter((signal) => signal.direction === "neutral")
      .length,
    bearish: currentSignals.filter((signal) => signal.direction === "bearish")
      .length,
  };

  const latestSignal = initialSignals.reduce<OutlookSignalDto | null>(
    (latest, signal) =>
      !latest || signal.asOfDate > latest.asOfDate ? signal : latest,
    null,
  );
  const regime = latestSignal?.regime ?? "neutral";

  useEffect(() => {
    if (!sessionUser || !effectiveSelectedSymbol) return;

    const controller = new AbortController();

    fetch(
      `/api/outlook/${encodeURIComponent(effectiveSelectedSymbol)}?live=1`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Quote request failed");
        const data = (await response.json()) as { quote: Quote | null };
        setQuoteResult({
          symbol: effectiveSelectedSymbol,
          quote: data.quote,
          state: data.quote ? "ready" : "unavailable",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setQuoteResult({
          symbol: effectiveSelectedSymbol,
          quote: null,
          state: "unavailable",
        });
      });

    return () => controller.abort();
  }, [effectiveSelectedSymbol, sessionUser]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      setSessionUser(null);
      router.refresh();
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#market-outlook">
        Skip to market outlook
      </a>

      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-3 focus-visible:outline-none"
            aria-label="Tell home"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--text)] font-mono text-[11px] font-semibold text-[var(--page)] transition-transform group-hover:-translate-y-0.5">
              T
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              Tell
            </span>
            <span className="hidden h-4 w-px bg-[var(--line-strong)] sm:block" />
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              Global macro research
            </span>
          </Link>

          <div
            data-testid="auth-nav"
            className="flex items-center gap-2 text-sm"
          >
            <ResearchChat
              symbol={effectiveSelectedSymbol || "SPY"}
              horizon={horizon}
              open={chatOpen}
              onOpenChange={setChatOpen}
              enabled={Boolean(sessionUser)}
            />
            <Link
              className="nav-link"
              href="/methodology"
              data-testid="nav-methodology"
            >
              Method
            </Link>
            <Link className="nav-link nav-system-link" href="/api/health">
              System
            </Link>
            {sessionUser ? (
              <>
                <span
                  data-testid="user-email"
                  className="hidden max-w-48 truncate text-xs text-[var(--muted)] md:block"
                >
                  {sessionUser.email}
                </span>
                <button
                  data-testid="logout-button"
                  type="button"
                  onClick={logout}
                  className="button-secondary"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  data-testid="nav-signin"
                  href="/login"
                  className="button-secondary"
                >
                  Sign in
                </Link>
                <Link
                  data-testid="nav-register"
                  href="/register"
                  className="button-primary nav-register-link"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        id="market-outlook"
        className="mx-auto max-w-[1480px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12"
      >
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className={`regime-mark regime-${regime}`}>
                {regime.replace("_", " ")}
              </span>
              <span className="font-mono text-[11px] text-[var(--muted)]">
                Data through {formatDate(latestSignal?.asOfDate ?? null)}
              </span>
            </div>
            <h1
              data-testid="home-heading"
              className="max-w-4xl text-balance text-[clamp(2.35rem,5vw,5.4rem)] font-semibold leading-[0.94] tracking-[-0.065em]"
            >
              Global activity,
              <br />
              translated into market outlook.
            </h1>
          </div>

          <div className="max-w-md border-l border-[var(--line-strong)] pl-5 lg:mb-1">
            <p className="text-sm leading-6 text-[var(--muted-strong)]">
              Transparent signals across equities, FX, commodities, and rates.
              Every view includes its evidence and confidence.
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Research aid only. Not financial advice or a guaranteed
              prediction.
            </p>
          </div>
        </section>

        <MacroSparklineStrip initialStrip={initialMacroStrip} />

        <NearTermBiasPanel initialBias={initialNearTermBias} />

        <section className="mt-10 grid gap-px overflow-hidden rounded-[16px] bg-[var(--line)] sm:grid-cols-3">
          <div className="metric-cell">
            <span className="metric-label">Bullish</span>
            <strong className="metric-value text-[var(--positive)]">
              {counts.bullish}
            </strong>
            <span className="metric-note">
              of {currentSignals.length} assets
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">Neutral</span>
            <strong className="metric-value">{counts.neutral}</strong>
            <span className="metric-note">{horizon} horizon</span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">Bearish</span>
            <strong className="metric-value text-[var(--negative)]">
              {counts.bearish}
            </strong>
            <span className="metric-note">rules-v1 model</span>
          </div>
        </section>

        <SignalQuality
          symbol={effectiveSelectedSymbol || undefined}
          horizon={horizon}
          enabled={Boolean(sessionUser)}
        />

        <EventsPanel
          symbol={effectiveSelectedSymbol || undefined}
          countryCode={selectedAsset?.countryCode ?? null}
          enabled={Boolean(sessionUser)}
        />

        <EventImpactPanel
          symbol={effectiveSelectedSymbol || undefined}
          enabled={Boolean(sessionUser)}
        />

        <AlertsPanel
          user={sessionUser}
          defaultSymbol={effectiveSelectedSymbol || "SPY"}
          defaultHorizon={horizon}
          watchlist={watchlist}
        />

        <div className="mt-10 flex flex-col gap-5 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Market outlook
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Star symbols to build a watchlist
              {sessionUser ? "" : " (sign in required)"}. Select a row for
              evidence.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="segmented-control"
              aria-label="Select signal horizon"
            >
              {HORIZONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={horizon === item}
                  onClick={() => setHorizon(item)}
                  className="segment"
                >
                  {item}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="asset-class">
              Asset class
            </label>
            <select
              id="asset-class"
              value={assetClass}
              onChange={(event) =>
                setAssetClass(event.target.value as AssetClass)
              }
              className="select-control"
              data-testid="asset-filter"
            >
              {ASSET_CLASSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {option.value === "watchlist" && watchlist.length > 0
                    ? ` (${watchlist.length})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <section className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
            <div
              className="outlook-grid outlook-grid-header"
              aria-hidden="true"
            >
              <span>Instrument</span>
              <span>View</span>
              <span className="hidden sm:block">Score</span>
              <span>Confidence</span>
            </div>

            {visibleAssets.length > 0 ? (
              <div>
                {visibleAssets.map((asset) => {
                  const signal = signalMap.get(`${asset.symbol}:${horizon}`)!;
                  const selected = asset.symbol === effectiveSelectedSymbol;
                  const watched = watchSet.has(asset.symbol);
                  return (
                    <div
                      key={asset.symbol}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedSymbol(asset.symbol)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedSymbol(asset.symbol);
                        }
                      }}
                      aria-pressed={selected}
                      className="outlook-grid outlook-row"
                      data-testid={`outlook-row-${asset.symbol}`}
                    >
                      <span className="min-w-0 text-left">
                        <span className="flex items-start gap-2">
                          <button
                            type="button"
                            className={`watch-star ${watched ? "watch-star-on" : ""}`}
                            aria-label={
                              watched
                                ? `Remove ${asset.symbol} from watchlist`
                                : `Add ${asset.symbol} to watchlist`
                            }
                            aria-pressed={watched}
                            disabled={watchBusy === asset.symbol}
                            data-testid={`watch-toggle-${asset.symbol}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleWatch(asset.symbol);
                            }}
                          >
                            {watched ? "★" : "☆"}
                          </button>
                          <span className="min-w-0">
                            <span className="flex items-baseline gap-2">
                              <strong className="font-mono text-sm font-semibold tracking-[-0.02em]">
                                {asset.symbol}
                              </strong>
                              <span className="hidden truncate text-xs text-[var(--muted)] md:inline">
                                {asset.countryCode}
                              </span>
                            </span>
                            <span className="mt-1 block truncate text-xs text-[var(--muted-strong)]">
                              {shortName(asset)}
                            </span>
                          </span>
                        </span>
                      </span>
                      <span
                        className={`direction direction-${signal.direction}`}
                      >
                        {directionLabel(signal.direction)}
                      </span>
                      <span
                        className={`hidden font-mono text-sm sm:block ${
                          signal.score > 0
                            ? "text-[var(--positive)]"
                            : signal.score < 0
                              ? "text-[var(--negative)]"
                              : ""
                        }`}
                      >
                        {formatScore(signal.score)}
                      </span>
                      <span className="flex items-center justify-between gap-3 sm:justify-start">
                        <span className="font-mono text-sm">
                          {formatConfidence(signal.confidence)}
                        </span>
                        <span
                          className={`row-arrow ${selected ? "row-arrow-selected" : ""}`}
                          aria-hidden="true"
                        >
                          ↗
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="px-6 py-16 text-center"
                data-testid="outlook-empty"
              >
                {assetClass === "watchlist" ? (
                  <>
                    <p className="font-medium">
                      {sessionUser
                        ? "Watchlist is empty"
                        : "Sign in to use watchlist"}
                    </p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {sessionUser ? (
                        <>
                          Star any instrument in{" "}
                          <button
                            type="button"
                            className="underline underline-offset-2"
                            onClick={() => setAssetClass("all")}
                          >
                            All markets
                          </button>{" "}
                          to pin it here.
                        </>
                      ) : (
                        <>
                          <Link
                            href="/login"
                            className="underline underline-offset-2"
                          >
                            Sign in
                          </Link>{" "}
                          to save symbols and jump back to them quickly.
                        </>
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">No signals in this view</p>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Choose another market class or compute more signals.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <aside
            className="h-fit rounded-[16px] border border-[var(--line)] bg-[var(--surface-raised)] p-5 xl:sticky xl:top-24"
            aria-live="polite"
          >
            {selectedAsset && selectedSignal ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {selectedAsset.assetClass} / {selectedAsset.countryCode}
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">
                      {selectedAsset.symbol}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted-strong)]">
                      {shortName(selectedAsset)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={`watch-star ${
                        watchSet.has(selectedAsset.symbol)
                          ? "watch-star-on"
                          : ""
                      }`}
                      aria-label={
                        watchSet.has(selectedAsset.symbol)
                          ? `Remove ${selectedAsset.symbol} from watchlist`
                          : `Add ${selectedAsset.symbol} to watchlist`
                      }
                      aria-pressed={watchSet.has(selectedAsset.symbol)}
                      disabled={watchBusy === selectedAsset.symbol}
                      data-testid={`watch-detail-${selectedAsset.symbol}`}
                      onClick={() => void toggleWatch(selectedAsset.symbol)}
                    >
                      {watchSet.has(selectedAsset.symbol) ? "★" : "☆"}
                    </button>
                    <span
                      className={`direction direction-${selectedSignal.direction}`}
                    >
                      {directionLabel(selectedSignal.direction)}
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] bg-[var(--line)]">
                  <div className="detail-stat">
                    <span>Signal score</span>
                    <strong>{formatScore(selectedSignal.score)}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>Confidence</span>
                    <strong>
                      {formatConfidence(selectedSignal.confidence)}
                    </strong>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
                      Live context
                    </h4>
                    {quote ? (
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        via {quote.source}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 min-h-10">
                    {quoteState === "loading" ? (
                      <div
                        className="quote-skeleton"
                        aria-label="Loading quote"
                      />
                    ) : quoteState === "ready" && quote ? (
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xl font-medium">
                          {formatPrice(quote.price, selectedAsset.currency)}
                        </span>
                        {quote.changePercent !== null ? (
                          <span
                            className={`font-mono text-xs ${
                              quote.changePercent >= 0
                                ? "text-[var(--positive)]"
                                : "text-[var(--negative)]"
                            }`}
                          >
                            {quote.changePercent >= 0 ? "+" : ""}
                            {(quote.changePercent * 100).toFixed(2)}%
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        Live quote unavailable. Daily signal is still current.
                      </p>
                    )}
                  </div>
                </div>

                <PriceChart
                  symbol={effectiveSelectedSymbol}
                  horizon={horizon}
                  enabled={Boolean(sessionUser)}
                />

                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
                    Evidence
                  </h4>
                  <div className="mt-3 space-y-3">
                    {selectedSignal.drivers.slice(0, 4).map((driver) => (
                      <div
                        key={`${driver.code}-${driver.detail}`}
                        className="grid grid-cols-[3.25rem_1fr] gap-3"
                      >
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {driver.code}
                        </span>
                        <p className="text-xs leading-5 text-[var(--muted-strong)]">
                          {driver.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
                    Across horizons
                  </h4>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {selectedHorizons.map((item) => (
                      <button
                        key={item.horizon}
                        type="button"
                        onClick={() => setHorizon(item.horizon)}
                        className={`horizon-tile ${
                          horizon === item.horizon ? "horizon-tile-active" : ""
                        }`}
                      >
                        <span>{item.horizon}</span>
                        <strong>
                          {item.signal ? formatScore(item.signal.score) : "N/A"}
                        </strong>
                      </button>
                    ))}
                  </div>
                </div>

                <ResearchBrief
                  symbol={effectiveSelectedSymbol}
                  horizon={horizon}
                  enabled={Boolean(sessionUser)}
                />
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="font-medium">Select an instrument</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Its signal evidence will appear here.
                </p>
              </div>
            )}
          </aside>
        </section>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-6 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Tell turns macro data into explainable market context.</span>
          <span className="flex flex-wrap items-center gap-3 font-mono">
            <Link
              href="/methodology"
              className="underline-offset-2 hover:underline"
            >
              Methodology
            </Link>
            <span>Not financial advice.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
