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

/** Neutral band widens slowly with horizon length. */
export function neutralBandForBars(bars: number): number {
  return 0.002 * Math.sqrt(Math.max(bars, 1));
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
  const neutralBand = neutralBandForBars(bars);
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
