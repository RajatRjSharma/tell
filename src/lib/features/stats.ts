import { mean, stdev, trailingWindow, type SeriesPoint } from "./series";

/**
 * Z-score of latest vs trailing `lookback` points through asOf.
 * Sample stdev; null if not enough history.
 */
export function zScoreTrailing(
  points: SeriesPoint[],
  asOf: string,
  lookback: number,
): number | null {
  const window = trailingWindow(points, asOf, lookback);
  if (window.length < 3) return null;

  const values = window.map((p) => p.value);
  const latest = values[values.length - 1]!;
  const m = mean(values);
  const s = stdev(values);
  if (m === null || s === null || s === 0) return null;
  return (latest - m) / s;
}
