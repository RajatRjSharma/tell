import {
  changeOverLags,
  indexAtOrBefore,
  pctChange,
  type SeriesPoint,
} from "./series";
import { mean, stdev } from "./series";

/** Simple return over `horizon` observations (e.g. 1, 5, 21 trading days). */
export function simpleReturn(
  closes: SeriesPoint[],
  asOf: string,
  horizon: number,
): number | null {
  return changeOverLags(closes, asOf, horizon);
}

/**
 * Annualized vol from trailing daily returns (~252 days).
 */
export function realizedVol(
  closes: SeriesPoint[],
  asOf: string,
  window: number,
): number | null {
  if (window < 2) return null;
  const end = indexAtOrBefore(closes, asOf);
  // window+1 closes → `window` returns
  if (end < 0 || end - window < 0) return null;

  const rets: number[] = [];
  for (let i = end - window + 1; i <= end; i++) {
    const r = pctChange(closes[i - 1]!.value, closes[i]!.value);
    if (r === null) return null;
    rets.push(r);
  }

  const s = stdev(rets);
  if (s === null) return null;
  return s * Math.sqrt(252);
}

/** Drawdown of latest close vs max close in trailing window. */
export function drawdownFromHigh(
  closes: SeriesPoint[],
  asOf: string,
  window: number,
): number | null {
  if (window < 1) return null;
  const end = indexAtOrBefore(closes, asOf);
  if (end < 0) return null;
  const start = Math.max(0, end - window + 1);
  let peak = -Infinity;
  for (let i = start; i <= end; i++) {
    peak = Math.max(peak, closes[i]!.value);
  }
  const last = closes[end]!.value;
  if (!Number.isFinite(peak) || peak <= 0) return null;
  return (last - peak) / peak;
}

export function averageReturn(
  closes: SeriesPoint[],
  asOf: string,
  window: number,
): number | null {
  if (window < 1) return null;
  const end = indexAtOrBefore(closes, asOf);
  if (end < 0 || end - window < 0) return null;
  const rets: number[] = [];
  for (let i = end - window + 1; i <= end; i++) {
    const r = pctChange(closes[i - 1]!.value, closes[i]!.value);
    if (r === null) return null;
    rets.push(r);
  }
  return mean(rets);
}
