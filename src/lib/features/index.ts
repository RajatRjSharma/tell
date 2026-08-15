import type { Client } from "@libsql/client";
import { computeMacroSeriesFeatures, defaultMacroOptions } from "./macro";
import { computeMarketFeatures } from "./market";
import {
  classifyUsRegime,
  type UsRegimeInputs,
  type UsRegimeResult,
} from "./regime";
import { loadAssetCloses, loadMacroSeries, latestAssetDate } from "./load";
import { changeOverLags, valueAtOrBefore } from "./series";

export {
  computeMarketFeatures,
  computeMacroSeriesFeatures,
  defaultMacroOptions,
  classifyUsRegime,
  loadAssetCloses,
  loadMacroSeries,
  latestAssetDate,
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

async function loadUsVix(db: Client) {
  for (const id of VIX_CANDIDATES) {
    const series = await loadMacroSeries(db, "US", id);
    if (series.length > 0) return { id, series };
  }
  return {
    id: "VIX",
    series: [] as Awaited<ReturnType<typeof loadMacroSeries>>,
  };
}

function yoyFromSeries(
  points: Awaited<ReturnType<typeof loadMacroSeries>>,
  asOf: string,
  lags: number,
): number | null {
  return changeOverLags(points, asOf, lags);
}

export async function buildFeatureSnapshot(
  db: Client,
  options?: {
    asOf?: string;
    symbols?: string[];
  },
): Promise<FeatureSnapshot> {
  const symbols = options?.symbols ?? ["SPY", "TLT", "GLD"];
  const asOf =
    options?.asOf ??
    (await latestAssetDate(db, symbols[0] ?? "SPY")) ??
    new Date().toISOString().slice(0, 10);

  const macroSeries = new Map<
    string,
    Awaited<ReturnType<typeof loadMacroSeries>>
  >();

  for (const id of US_MACRO_IDS) {
    macroSeries.set(id, await loadMacroSeries(db, "US", id));
  }

  const vixLoaded = await loadUsVix(db);
  macroSeries.set(vixLoaded.id, vixLoaded.series);

  const macro = [...macroSeries.entries()].map(([id, points]) =>
    computeMacroSeriesFeatures(id, points, asOf, defaultMacroOptions(id)),
  );

  const cpi = macroSeries.get("CPI") ?? [];
  const indpro = macroSeries.get("INDPRO") ?? [];
  const fed = macroSeries.get("FEDFUNDS") ?? [];
  const curve = macroSeries.get("T10Y2Y") ?? [];
  const vixPoints = vixLoaded.series;

  const inputs: UsRegimeInputs = {
    cpiYoy: yoyFromSeries(cpi, asOf, 12),
    indproYoy: yoyFromSeries(indpro, asOf, 12),
    fedFunds: valueAtOrBefore(fed, asOf)?.value ?? null,
    curveSpread: valueAtOrBefore(curve, asOf)?.value ?? null,
    vix: valueAtOrBefore(vixPoints, asOf)?.value ?? null,
  };

  const regime = classifyUsRegime(asOf, inputs);

  const markets = [];
  for (const symbol of symbols) {
    const closes = await loadAssetCloses(db, symbol);
    markets.push(computeMarketFeatures(symbol, closes, asOf));
  }

  return { asOf, regime, macro, markets };
}
