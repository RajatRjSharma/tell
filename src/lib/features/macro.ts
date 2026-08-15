import { changeOverLags, valueAtOrBefore, type SeriesPoint } from "./series";
import { zScoreTrailing } from "./stats";

export type MacroSeriesFeatures = {
  indicatorId: string;
  asOf: string;
  level: number | null;
  observedFor: string | null;
  /** Change vs N observations earlier (e.g. 12 for YoY monthly). */
  changeLag: number | null;
  zScore: number | null;
};

export type MacroFeatureOptions = {
  /** Observations for pct change (12 ≈ YoY monthly, 252 ≈ YoY daily). */
  changeLags?: number;
  /** Trailing points for z-score. */
  zLookback?: number;
};

export function computeMacroSeriesFeatures(
  indicatorId: string,
  points: SeriesPoint[],
  asOf: string,
  options?: MacroFeatureOptions,
): MacroSeriesFeatures {
  const changeLags = options?.changeLags ?? 12;
  const zLookback = options?.zLookback ?? 36;
  const latest = valueAtOrBefore(points, asOf);

  return {
    indicatorId,
    asOf,
    level: latest?.value ?? null,
    observedFor: latest?.date ?? null,
    changeLag: changeOverLags(points, asOf, changeLags),
    zScore: zScoreTrailing(points, asOf, zLookback),
  };
}

/** Default lag/lookback by known indicator frequency heuristics. */
export function defaultMacroOptions(indicatorId: string): MacroFeatureOptions {
  const daily = new Set([
    "DGS10",
    "DGS2",
    "T10Y2Y",
    "VIX",
    "VIXCLS",
    "DTWEXBGS",
  ]);
  if (daily.has(indicatorId) || indicatorId.includes("VIX")) {
    return { changeLags: 21, zLookback: 252 };
  }
  // monthly / quarterly: ~12 obs YoY-ish for monthly; quarterly gets shorter history
  return { changeLags: 12, zLookback: 36 };
}
