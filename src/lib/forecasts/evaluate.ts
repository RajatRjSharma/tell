import type { SignalDirection } from "@/lib/signals/score";
import { horizonToBars } from "@/lib/signals/horizons";
import {
  indexAtOrBefore,
  pctChange,
  type SeriesPoint,
} from "@/lib/features/series";

export type ForecastOutcome = {
  actualReturn: number;
  correct: boolean;
  neutralBand: number;
};

/** Fixed fallback band when an instrument lacks enough history. */
export function neutralBandForBars(bars: number): number {
  return 0.002 * Math.sqrt(Math.max(bars, 1));
}

export const VOL_WINDOW_BARS = 60;
const MIN_VOL_RETURNS = 20;
const NEUTRAL_VOL_MULTIPLE = 0.5;

/**
 * Standard deviation of daily simple returns over the window ending at
 * `endIndex` (inclusive). Only uses closes at or before `endIndex`, so a
 * grade never sees prices after the signal date.
 */
export function dailyVolatility(
  closes: SeriesPoint[],
  endIndex: number,
  window = VOL_WINDOW_BARS,
): number | null {
  const start = Math.max(1, endIndex - window + 1);
  const returns: number[] = [];
  for (let i = start; i <= endIndex; i += 1) {
    const change = pctChange(closes[i - 1]!.value, closes[i]!.value);
    if (change != null && Number.isFinite(change)) returns.push(change);
  }
  if (returns.length < MIN_VOL_RETURNS) return null;
  const mean = returns.reduce((acc, value) => acc + value, 0) / returns.length;
  const variance =
    returns.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    (returns.length - 1);
  return Math.sqrt(variance);
}

/**
 * Neutral is "moved less than half a typical move for this instrument over
 * this horizon", so quiet assets (USDCNY) and volatile ones (oil) face a
 * comparable bar.
 */
export function neutralBandFor(bars: number, dailyVol: number | null): number {
  if (dailyVol == null || dailyVol <= 0) return neutralBandForBars(bars);
  return NEUTRAL_VOL_MULTIPLE * dailyVol * Math.sqrt(Math.max(bars, 1));
}

export function isDirectionCorrect(
  direction: SignalDirection | string,
  actualReturn: number,
  neutralBand: number,
): boolean {
  if (direction === "bullish") return actualReturn > 0;
  if (direction === "bearish") return actualReturn < 0;
  return Math.abs(actualReturn) <= neutralBand;
}

/** Forward simple return from asOf across `horizon` trading bars. */
export function forwardReturn(
  closes: SeriesPoint[],
  asOfDate: string,
  horizonBars: number,
): number | null {
  if (horizonBars <= 0) return null;
  const start = indexAtOrBefore(closes, asOfDate);
  if (start < 0) return null;
  const end = start + horizonBars;
  if (end >= closes.length) return null;
  return pctChange(closes[start]!.value, closes[end]!.value);
}

export function evaluateForwardReturn(
  closes: SeriesPoint[],
  asOfDate: string,
  horizon: string,
): ForecastOutcome | null {
  const bars = horizonToBars(horizon);
  const actualReturn = forwardReturn(closes, asOfDate, bars);
  if (actualReturn === null) return null;
  const neutralBand = neutralBandFor(
    bars,
    dailyVolatility(closes, indexAtOrBefore(closes, asOfDate)),
  );
  return {
    actualReturn,
    correct: false,
    neutralBand,
  };
}

export function evaluateSignalOutcome(
  direction: SignalDirection | string,
  closes: SeriesPoint[],
  asOfDate: string,
  horizon: string,
): ForecastOutcome | null {
  const base = evaluateForwardReturn(closes, asOfDate, horizon);
  if (!base) return null;
  return {
    ...base,
    correct: isDirectionCorrect(direction, base.actualReturn, base.neutralBand),
  };
}

export type QualityStats = {
  n: number;
  hits: number;
  hitRate: number | null;
  avgReturnWhenBullish: number | null;
  avgReturnWhenBearish: number | null;
};

export function summarizeOutcomes(
  rows: Array<{
    direction: string;
    actualReturn: number | null;
    correct: number | null;
  }>,
): QualityStats {
  const evaluated = rows.filter(
    (row) => row.actualReturn != null && row.correct != null,
  );
  const hits = evaluated.filter((row) => row.correct === 1).length;
  const bullish = evaluated.filter((row) => row.direction === "bullish");
  const bearish = evaluated.filter((row) => row.direction === "bearish");

  const avg = (list: typeof evaluated): number | null => {
    if (list.length === 0) return null;
    const sum = list.reduce((acc, row) => acc + Number(row.actualReturn), 0);
    return sum / list.length;
  };

  return {
    n: evaluated.length,
    hits,
    hitRate: evaluated.length === 0 ? null : hits / evaluated.length,
    avgReturnWhenBullish: avg(bullish),
    avgReturnWhenBearish: avg(bearish),
  };
}
