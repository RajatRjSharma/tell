/** Ordered time series point (ascending by date). */
export type SeriesPoint = {
  date: string;
  value: number;
};

export function assertAscending(points: SeriesPoint[]): void {
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.date < points[i - 1]!.date) {
      throw new Error("Series must be sorted ascending by date");
    }
  }
}

/** Last point on or before asOf (inclusive). */
export function valueAtOrBefore(
  points: SeriesPoint[],
  asOf: string,
): SeriesPoint | null {
  let best: SeriesPoint | null = null;
  for (const p of points) {
    if (p.date > asOf) break;
    best = p;
  }
  return best;
}

/** Index of last point on or before asOf, or -1. */
export function indexAtOrBefore(points: SeriesPoint[], asOf: string): number {
  let lo = 0;
  let hi = points.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.date <= asOf) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Trailing window ending at asOf (inclusive), up to `count` points. */
export function trailingWindow(
  points: SeriesPoint[],
  asOf: string,
  count: number,
): SeriesPoint[] {
  if (count <= 0) return [];
  const end = indexAtOrBefore(points, asOf);
  if (end < 0) return [];
  const start = Math.max(0, end - count + 1);
  return points.slice(start, end + 1);
}

export function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return (to - from) / Math.abs(from);
}

/** Change vs the point `lag` observations earlier (by index, not calendar). */
export function changeOverLags(
  points: SeriesPoint[],
  asOf: string,
  lag: number,
): number | null {
  if (lag <= 0) return null;
  const end = indexAtOrBefore(points, asOf);
  if (end < 0 || end - lag < 0) return null;
  return pctChange(points[end - lag]!.value, points[end]!.value);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / values.length;
}

/** Sample standard deviation (n-1). */
export function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (m === null) return null;
  let sq = 0;
  for (const v of values) {
    const d = v - m;
    sq += d * d;
  }
  return Math.sqrt(sq / (values.length - 1));
}
