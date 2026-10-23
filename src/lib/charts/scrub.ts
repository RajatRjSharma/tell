/** Index of the x closest to `x` (xs ascending). Returns -1 for no points. */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) return -1;
  let lo = 0;
  let hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1]! - x) <= Math.abs(xs[lo]! - x)) {
    return lo - 1;
  }
  return lo;
}

/** Keep a floating tooltip inside the chart near the edges. */
export function tooltipAlign(ratio: number): "start" | "center" | "end" {
  if (ratio < 0.22) return "start";
  if (ratio > 0.78) return "end";
  return "center";
}

const MONTHS = [
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
];

/** "2026-10-22" → "22 Oct 2026"; monthly → "Oct 2026". */
export function formatChartDate(
  isoDate: string,
  granularity: "day" | "month" = "day",
): string {
  const [year, month, day] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!year || !name) return isoDate;
  if (granularity === "month" || !day) return `${name} ${year}`;
  return `${Number(day)} ${name} ${year}`;
}
