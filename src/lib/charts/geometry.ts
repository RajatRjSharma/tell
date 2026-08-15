export type ChartBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type ChartSignalMarker = {
  date: string;
  horizon: string;
  direction: string;
  score: number;
  confidence: number | null;
};

export type ChartPoint = {
  x: number;
  y: number;
  date: string;
  close: number;
};

export function seriesChangePct(bars: ChartBar[]): number | null {
  if (bars.length < 2) return null;
  const first = bars[0]!.close;
  const last = bars[bars.length - 1]!.close;
  if (!Number.isFinite(first) || first === 0 || !Number.isFinite(last)) {
    return null;
  }
  return (last - first) / Math.abs(first);
}

export function buildChartGeometry(
  bars: ChartBar[],
  width: number,
  height: number,
  padding = { top: 12, right: 12, bottom: 22, left: 12 },
): {
  points: ChartPoint[];
  linePath: string;
  areaPath: string;
  min: number;
  max: number;
} {
  if (bars.length === 0) {
    return { points: [], linePath: "", areaPath: "", min: 0, max: 0 };
  }

  const closes = bars.map((bar) => bar.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || 1;
  const innerW = Math.max(width - padding.left - padding.right, 1);
  const innerH = Math.max(height - padding.top - padding.bottom, 1);

  const points = bars.map((bar, index) => {
    const x =
      padding.left +
      (bars.length === 1 ? innerW / 2 : (index / (bars.length - 1)) * innerW);
    const y = padding.top + (1 - (bar.close - min) / span) * innerH;
    return { x, y, date: bar.date, close: bar.close };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  const baseline = padding.top + innerH;
  const areaPath =
    points.length === 0
      ? ""
      : `${linePath} L${points[points.length - 1]!.x} ${baseline} L${points[0]!.x} ${baseline} Z`;

  return { points, linePath, areaPath, min, max };
}
