"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OutlookSignalDto } from "@/lib/api/outlook";
import { EconomicTerm, type EconomicTermKey } from "@/components/EconomicTerm";
import { ResearchBrief } from "@/components/ResearchBrief";
import { ResearchChat } from "@/components/ResearchChat";
import { PriceChart } from "@/components/PriceChart";
import { SignalQuality } from "@/components/SignalQuality";
import { AlertsPanel } from "@/components/AlertsPanel";
import { EventsPanel } from "@/components/EventsPanel";
import { EventImpactPanel } from "@/components/EventImpactPanel";
import { MacroSparklineStrip } from "@/components/MacroSparklineStrip";
import { NearTermBiasPanel } from "@/components/NearTermBiasPanel";
import { DecisionSummaryPanel } from "@/components/DecisionSummaryPanel";
import { RegimeExplainerPanel } from "@/components/RegimeExplainerPanel";
import { SiteHeader } from "@/components/SiteHeader";
import type { MacroStrip } from "@/lib/macro/sparklines";
import type { NearTermBias } from "@/lib/risk/near-term";
import type { RegimeExplainer } from "@/lib/features/regime-explain";
import { buildDecisionSummary } from "@/lib/decision/summary";
import { describeHorizon } from "@/lib/decision/horizons";
import { plainRegimeLabel } from "@/lib/features/regime-explain";
import type { UsRegime } from "@/lib/features/regime";
import {
  buildMarketScopes,
  countryMatchesScope,
  resolveMarketScope,
  type MarketCountry,
} from "@/lib/scope/market-scope";

type User = { id: string; email: string; username: string };

type Asset = {
  symbol: string;
  name: string;
  assetClass: string;
  countryCode: string;
  currency: string;
};

type Country = MarketCountry;

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

function driverTerm(code: string): EconomicTermKey | null {
  if (code === "regime") return "regime";
  if (code === "momentum") return "momentum";
  if (code === "volatility") return "volatility";
  if (code === "drawdown") return "drawdown";
  return null;
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
  countries,
  initialSignals,
  initialWatchlist = [],
  initialMacroStrip = null,
  initialNearTermBias = null,
  initialRegimeExplainer = null,
}: {
  user: User | null;
  assets: Asset[];
  countries: Country[];
  initialSignals: OutlookSignalDto[];
  initialWatchlist?: string[];
  initialMacroStrip?: MacroStrip | null;
  initialNearTermBias?: NearTermBias | null;
  initialRegimeExplainer?: RegimeExplainer | null;
}) {
  const router = useRouter();
  const sessionUser = user;
  const [scopeValue, setScopeValue] = useState("world");
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

  const watchSet = useMemo(() => new Set(watchlist), [watchlist]);
  const marketScopes = useMemo(() => buildMarketScopes(countries), [countries]);
  const activeScope = useMemo(
    () => resolveMarketScope(scopeValue, marketScopes),
    [marketScopes, scopeValue],
  );

  const signalMap = useMemo(() => {
    const map = new Map<string, OutlookSignalDto>();
    for (const signal of initialSignals) {
      map.set(`${signal.symbol}:${signal.horizon}`, signal);
    }
    return map;
  }, [initialSignals]);

  const scopeAssets = useMemo(
    () =>
      assets.filter((asset) =>
        countryMatchesScope(asset.countryCode, activeScope, countries),
      ),
    [activeScope, assets, countries],
  );

  const visibleAssets = useMemo(
    () =>
      scopeAssets.filter((asset) => {
        if (!signalMap.has(`${asset.symbol}:${horizon}`)) return false;
        if (assetClass === "watchlist") return watchSet.has(asset.symbol);
        if (assetClass === "all") return true;
        return asset.assetClass === assetClass;
      }),
    [assetClass, horizon, scopeAssets, signalMap, watchSet],
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
    : (visibleAssets[0]?.symbol ?? "");
  const selectedAsset =
    assets.find((asset) => asset.symbol === effectiveSelectedSymbol) ?? null;
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

  const latestSignal = currentSignals.reduce<OutlookSignalDto | null>(
    (latest, signal) =>
      !latest || signal.asOfDate > latest.asOfDate ? signal : latest,
    null,
  );
  const regime = (initialRegimeExplainer?.regime ??
    latestSignal?.regime ??
    "neutral") as UsRegime;
  const regimeLabel = plainRegimeLabel(regime);
  const scopeCountryCodes = countries
    .filter((country) =>
      countryMatchesScope(country.code, activeScope, countries),
    )
    .map((country) => country.code);
  const scopedSymbols = visibleAssets.map((asset) => asset.symbol);
  const assetClassLabel =
    ASSET_CLASSES.find((option) => option.value === assetClass)?.label ??
    "All markets";
  const pageScopeLabel =
    assetClass === "all"
      ? activeScope.label
      : `${activeScope.label} · ${assetClassLabel}`;

  const decisionSummary = useMemo(
    () =>
      buildDecisionSummary({
        signals: currentSignals,
        horizon,
        scope: {
          level:
            activeScope.kind === "world"
              ? "world"
              : activeScope.kind === "region"
                ? "region"
                : "country",
          label: pageScopeLabel,
          countryCode:
            activeScope.kind === "country" ? activeScope.countryCode : null,
        },
        asOfDate: latestSignal?.asOfDate ?? null,
      }),
    [
      activeScope,
      currentSignals,
      horizon,
      latestSignal?.asOfDate,
      pageScopeLabel,
    ],
  );

  const horizonInfo = describeHorizon(horizon);

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

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#market-outlook">
        Skip to market outlook
      </a>

      <SiteHeader
        sectionLabel="Global macro research"
        active="outlook"
        user={sessionUser}
        leadingActions={
          <ResearchChat
            symbol={effectiveSelectedSymbol || "SPY"}
            horizon={horizon}
            open={chatOpen}
            onOpenChange={setChatOpen}
            enabled={Boolean(sessionUser)}
          />
        }
      />

      <main
        id="market-outlook"
        className="mx-auto max-w-[1480px] px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12"
      >
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className={`regime-mark regime-${regime}`}>
                <EconomicTerm term="regime">{regimeLabel}</EconomicTerm>
              </span>
              <span className="font-mono text-[11px] text-[var(--muted)]">
                US macro backdrop · as of{" "}
                {formatDate(initialRegimeExplainer?.asOf ?? null)}
              </span>
            </div>
            <h1
              data-testid="home-heading"
              className="max-w-4xl text-balance text-[clamp(2.1rem,10vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.055em] sm:leading-[0.94] sm:tracking-[-0.065em]"
            >
              What the data suggests,
              <br />
              in plain language.
            </h1>
          </div>

          <div className="max-w-md border-l border-[var(--line-strong)] pl-4 sm:pl-5 lg:mb-1">
            <p className="text-sm leading-6 text-[var(--muted-strong)]">
              Transparent research leans across{" "}
              <EconomicTerm term="equities">equities</EconomicTerm>,{" "}
              <EconomicTerm term="fx">FX</EconomicTerm>,{" "}
              <EconomicTerm term="commodities">commodities</EconomicTerm>, and{" "}
              <EconomicTerm term="rates">rates</EconomicTerm>. Every view says
              what, where, when, why, and how strong the evidence looks.
            </p>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Research aid only. Not financial advice or a guaranteed
              prediction.
            </p>
          </div>
        </section>

        <MacroSparklineStrip initialStrip={initialMacroStrip} />

        <RegimeExplainerPanel
          explainer={initialRegimeExplainer}
          viewScopeLabel={activeScope.label}
        />

        <section
          className="mt-8 flex flex-col gap-4 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5"
          data-testid="market-scope-control"
          aria-label="Page market scope"
        >
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--accent)]">
              Scope starts here
            </p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">
              Viewing {activeScope.label}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-strong)]">
              {activeScope.description}. Everything below this control follows
              the selected geography: decision summary, next-session bias,
              bullish/neutral/bearish counts, signal quality, policy events,
              event-impact study, and market rows.
            </p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              Everything above stays a US macro backdrop (strip + regime). Tell
              does not yet ship local country regimes.
            </p>
          </div>
          <label className="min-w-0 text-xs text-[var(--muted)] sm:w-64">
            World, region, or country
            <select
              className="select-control mt-1 w-full"
              value={scopeValue}
              onChange={(event) => setScopeValue(event.target.value)}
              data-testid="market-scope"
            >
              <option value="world">World · all loaded markets</option>
              <optgroup label="Regions">
                {marketScopes
                  .filter((scope) => scope.kind === "region")
                  .map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Countries">
                {marketScopes
                  .filter((scope) => scope.kind === "country")
                  .map((scope) => (
                    <option key={scope.value} value={scope.value}>
                      {scope.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
        </section>

        <DecisionSummaryPanel summary={decisionSummary} />

        <NearTermBiasPanel
          initialBias={initialNearTermBias}
          symbols={
            activeScope.kind === "world" && assetClass === "all"
              ? undefined
              : scopedSymbols
          }
          scopeLabel={pageScopeLabel}
        />

        <section className="mt-10 grid gap-px overflow-hidden rounded-[16px] bg-[var(--line)] sm:grid-cols-3">
          <div className="metric-cell">
            <span className="metric-label">
              <EconomicTerm term="bullish" />
            </span>
            <strong className="metric-value text-[var(--positive)]">
              {counts.bullish}
            </strong>
            <span className="metric-note">
              of {currentSignals.length} assets in this view
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">
              <EconomicTerm term="neutral" />
            </span>
            <strong className="metric-value">{counts.neutral}</strong>
            <span className="metric-note">{horizonInfo.shortLabel}</span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">
              <EconomicTerm term="bearish" />
            </span>
            <strong className="metric-value text-[var(--negative)]">
              {counts.bearish}
            </strong>
            <span className="metric-note">rules-v1 model</span>
          </div>
        </section>

        <SignalQuality
          symbols={
            activeScope.kind === "world" && assetClass === "all"
              ? undefined
              : scopedSymbols
          }
          scopeLabel={pageScopeLabel}
          horizon={horizon}
          enabled={Boolean(sessionUser)}
        />

        <EventsPanel
          scopeLabel={activeScope.label}
          countryCodes={
            activeScope.kind === "world" ? undefined : scopeCountryCodes
          }
          symbols={scopedSymbols}
          enabled={Boolean(sessionUser)}
        />

        {selectedAsset ? (
          <EventImpactPanel
            symbols={scopedSymbols}
            scopeLabel={pageScopeLabel}
            enabled={Boolean(sessionUser)}
          />
        ) : null}

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
            <p className="mt-2 text-xs text-[var(--muted)]">
              <EconomicTerm term="horizon">
                Forecast periods use trading sessions
              </EconomicTerm>
              : {horizonInfo.longLabel}.
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
                  title={describeHorizon(item).longLabel}
                >
                  {describeHorizon(item).shortLabel}
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

        <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)]">
          <div className="min-w-0 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
            <div className="outlook-grid outlook-grid-header">
              <span>Instrument</span>
              <span>View</span>
              <span className="hidden sm:block">
                <EconomicTerm term="signalScore">Score</EconomicTerm>
              </span>
              <span>
                <EconomicTerm term="confidence">Evidence</EconomicTerm>
              </span>
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
            className="h-fit min-w-0 rounded-[16px] border border-[var(--line)] bg-[var(--surface-raised)] p-4 sm:p-5 lg:sticky lg:top-24"
            aria-live="polite"
          >
            {selectedAsset && selectedSignal ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-[var(--muted)]">
                      {selectedAsset.assetClass} / {selectedAsset.countryCode}
                    </span>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">
                      {selectedAsset.symbol}
                    </h3>
                    <p className="mt-1 break-words text-sm text-[var(--muted-strong)]">
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
                    <span>
                      <EconomicTerm term="signalScore" />
                    </span>
                    <strong>{formatScore(selectedSignal.score)}</strong>
                  </div>
                  <div className="detail-stat">
                    <span>
                      <EconomicTerm term="confidence">Evidence</EconomicTerm>
                    </span>
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
                    Evidence used in this score
                  </h4>
                  <div className="mt-3 space-y-3">
                    {selectedSignal.drivers.slice(0, 4).map((driver) => (
                      <div
                        key={`${driver.code}-${driver.detail}`}
                        className="grid grid-cols-[3.25rem_1fr] gap-3"
                      >
                        <span className="font-mono text-[10px] text-[var(--muted)]">
                          {driverTerm(driver.code) ? (
                            <EconomicTerm term={driverTerm(driver.code)!}>
                              {driver.code}
                            </EconomicTerm>
                          ) : (
                            driver.code
                          )}
                        </span>
                        <p className="min-w-0 break-words text-xs leading-5 text-[var(--muted-strong)]">
                          {driver.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-[var(--line)] pt-5">
                  <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
                    <EconomicTerm term="horizon">
                      Across forecast periods
                    </EconomicTerm>
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
                        title={describeHorizon(item.horizon).longLabel}
                      >
                        <span>{describeHorizon(item.horizon).shortLabel}</span>
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
