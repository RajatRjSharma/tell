export type SparkPoint = {
  date: string;
  value: number;
};

export type MacroSparkSeries = {
  id: string;
  label: string;
  unit: "index" | "percent" | "level";
  latest: number | null;
  asOf: string | null;
  change: number | null;
  rangeChange: number | null;
  points: SparkPoint[];
};

export type MacroStrip = {
  countryCode: string;
  series: MacroSparkSeries[];
};

/** Sparkline SVG path (values ascending in time). */
export function buildSparklinePath(
  values: number[],
  width: number,
  height: number,
  padding = 2,
): string {
  if (values.length === 0) return "";
  if (values.length === 1) {
    const y = height / 2;
    return `M ${padding} ${y} L ${width - padding} ${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = Math.max(width - padding * 2, 1);
  const innerH = Math.max(height - padding * 2, 1);

  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * innerW;
      const y = padding + (1 - (value - min) / span) * innerH;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function seriesDelta(points: SparkPoint[]): {
  change: number | null;
  rangeChange: number | null;
} {
  if (points.length === 0) {
    return { change: null, rangeChange: null };
  }
  const latest = points[points.length - 1]!.value;
  const prev = points.length > 1 ? points[points.length - 2]!.value : null;
  const first = points[0]!.value;

  const change = prev != null && Number.isFinite(prev) ? latest - prev : null;
  const rangeChange =
    Number.isFinite(first) && points.length > 1 ? latest - first : null;

  return { change, rangeChange };
}

export function formatSparkValue(
  value: number | null,
  unit: MacroSparkSeries["unit"],
): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  if (unit === "percent") {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
  }
  if (unit === "level") {
    return value.toFixed(1);
  }
  return value.toLocaleString("en", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

export function formatSparkDelta(
  delta: number | null,
  unit: MacroSparkSeries["unit"],
): string {
  if (delta == null || !Number.isFinite(delta)) return "n/a";
  const sign = delta > 0 ? "+" : "";
  if (unit === "percent") {
    return `${sign}${delta.toFixed(2)}`;
  }
  if (unit === "level") {
    return `${sign}${delta.toFixed(1)}`;
  }
  return `${sign}${delta.toFixed(2)}`;
}

export const MACRO_STRIP_SPECS = [
  {
    id: "CPI",
    label: "CPI",
    unit: "index" as const,
    fallbackIds: [] as string[],
  },
  {
    id: "T10Y2Y",
    label: "Curve",
    unit: "percent" as const,
    fallbackIds: [] as string[],
  },
  {
    id: "VIXCLS",
    label: "VIX",
    unit: "level" as const,
    fallbackIds: ["VIX"],
  },
] as const;
