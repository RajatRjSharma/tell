import type { Client } from "@libsql/client";
import { computeMacroSeriesFeatures, defaultMacroOptions } from "./macro";
import { computeMarketFeatures } from "./market";
import {
  classifyUsRegime,
  type UsRegimeInputs,
  type UsRegimeResult,
} from "./regime";
import {
  loadAssetCloses,
  loadMacroSeries,
  latestAssetDate,
  listTradingDates,
} from "./load";
import { changeOverLags, valueAtOrBefore, type SeriesPoint } from "./series";

export {
  computeMarketFeatures,
  computeMacroSeriesFeatures,
  defaultMacroOptions,
  classifyUsRegime,
  loadAssetCloses,
  loadMacroSeries,
  latestAssetDate,
  listTradingDates,
};

export type { MarketFeatures } from "./market";
export type { MacroSeriesFeatures } from "./macro";
export type { UsRegime, UsRegimeInputs, UsRegimeResult } from "./regime";
export type { SeriesPoint } from "./series";

const US_MACRO_IDS = [
  "CPI",
  "INDPRO",
  "FEDFUNDS",
  "T10Y2Y",
  "DGS10",
  "DGS2",
] as const;

const VIX_CANDIDATES = ["VIXCLS", "VIX"] as const;

export type FeatureSnapshot = {
  asOf: string;
  regime: UsRegimeResult;
  macro: ReturnType<typeof computeMacroSeriesFeatures>[];
  markets: ReturnType<typeof computeMarketFeatures>[];
};

export type FeatureSeriesCache = {
  macroSeries: Map<string, SeriesPoint[]>;
  vixId: string;
  marketCloses: Map<string, SeriesPoint[]>;
};

async function loadUsVix(db: Client) {
  for (const id of VIX_CANDIDATES) {
    const series = await loadMacroSeries(db, "US", id);
    if (series.length > 0) return { id, series };
  }
  return {
    id: "VIX",
    series: [] as SeriesPoint[],
  };
}

function yoyFromSeries(
  points: SeriesPoint[],
  asOf: string,
  lags: number,
): number | null {
  return changeOverLags(points, asOf, lags);
}

/** Load macro + market series once for multi-day backfills. */
export async function preloadFeatureSeries(
  db: Client,
  symbols: string[],
): Promise<FeatureSeriesCache> {
  const macroSeries = new Map<string, SeriesPoint[]>();
  for (const id of US_MACRO_IDS) {
    macroSeries.set(id, await loadMacroSeries(db, "US", id));
  }

  const vixLoaded = await loadUsVix(db);
  macroSeries.set(vixLoaded.id, vixLoaded.series);

  const marketCloses = new Map<string, SeriesPoint[]>();
  for (const symbol of symbols) {
    marketCloses.set(symbol, await loadAssetCloses(db, symbol));
  }

  return {
    macroSeries,
    vixId: vixLoaded.id,
    marketCloses,
  };
}

/** Point-in-time snapshot from an already-loaded series cache. */
export function buildFeatureSnapshotFromCache(
  cache: FeatureSeriesCache,
  asOf: string,
  symbols: string[],
): FeatureSnapshot {
  const macro = [...cache.macroSeries.entries()].map(([id, points]) =>
    computeMacroSeriesFeatures(id, points, asOf, defaultMacroOptions(id)),
  );

  const cpi = cache.macroSeries.get("CPI") ?? [];
  const indpro = cache.macroSeries.get("INDPRO") ?? [];
  const fed = cache.macroSeries.get("FEDFUNDS") ?? [];
  const curve = cache.macroSeries.get("T10Y2Y") ?? [];
  const vixPoints = cache.macroSeries.get(cache.vixId) ?? [];

  const inputs: UsRegimeInputs = {
    cpiYoy: yoyFromSeries(cpi, asOf, 12),
    indproYoy: yoyFromSeries(indpro, asOf, 12),
    fedFunds: valueAtOrBefore(fed, asOf)?.value ?? null,
    curveSpread: valueAtOrBefore(curve, asOf)?.value ?? null,
    vix: valueAtOrBefore(vixPoints, asOf)?.value ?? null,
  };

  const regime = classifyUsRegime(asOf, inputs);

  const markets = symbols.map((symbol) =>
    computeMarketFeatures(symbol, cache.marketCloses.get(symbol) ?? [], asOf),
  );

  return { asOf, regime, macro, markets };
}

export async function buildFeatureSnapshot(
  db: Client,
  options?: {
    asOf?: string;
    symbols?: string[];
    cache?: FeatureSeriesCache;
  },
): Promise<FeatureSnapshot> {
  const symbols = options?.symbols ?? ["SPY", "TLT", "GLD"];
  const asOf =
    options?.asOf ??
    (await latestAssetDate(db, symbols[0] ?? "SPY")) ??
    new Date().toISOString().slice(0, 10);

  const cache = options?.cache ?? (await preloadFeatureSeries(db, symbols));

  return buildFeatureSnapshotFromCache(cache, asOf, symbols);
}
