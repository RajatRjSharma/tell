import type { Client } from "@libsql/client";
import { listReadings } from "@/lib/api/readings-query";
import { changeOverLags } from "@/lib/features/series";
import {
  MACRO_STRIP_SPECS,
  seriesDelta,
  type MacroSparkSeries,
  type MacroStrip,
  type SparkPoint,
} from "@/lib/macro/sparklines";

async function loadSparkPoints(
  db: Client,
  indicatorId: string,
  limit: number,
): Promise<SparkPoint[]> {
  const readings = await listReadings(db, {
    countryCode: "US",
    indicatorId,
    limit,
  });
  // Newest-first from DB → chronological for the chart.
  return readings
    .slice()
    .reverse()
    .map((row) => ({
      date: row.observedFor,
      value: row.value,
    }));
}

function cpiYoyContext(points: SparkPoint[]): MacroSparkSeries["context"] {
  if (points.length === 0) return null;
  const asOf = points[points.length - 1]!.date;
  const yoy = changeOverLags(points, asOf, 12);
  if (yoy == null) {
    return {
      label: "Inflation (YoY)",
      valueLabel: "n/a",
      note: "Need ~13 monthly CPI readings to compute year-over-year inflation.",
    };
  }
  const pct = `${(yoy * 100).toFixed(1)}%`;
  return {
    label: "Inflation (YoY)",
    valueLabel: pct,
    note: "Regime classification uses this YoY inflation rate, not the CPI index level shown above.",
  };
}

export async function getMacroStrip(
  db: Client,
  options?: { limit?: number },
): Promise<MacroStrip> {
  const limit = Math.min(Math.max(options?.limit ?? 24, 6), 120);
  const series: MacroSparkSeries[] = [];

  for (const spec of MACRO_STRIP_SPECS) {
    // CPI needs extra history for YoY context.
    const fetchLimit = spec.id === "CPI" ? Math.max(limit, 18) : limit;
    let points = await loadSparkPoints(db, spec.id, fetchLimit);
    let id: string = spec.id;

    if (points.length === 0) {
      for (const fallback of spec.fallbackIds) {
        points = await loadSparkPoints(db, fallback, fetchLimit);
        if (points.length > 0) {
          id = fallback;
          break;
        }
      }
    }

    // Chart still shows the requested window.
    const chartPoints =
      points.length > limit ? points.slice(points.length - limit) : points;
    const latestPoint = chartPoints[chartPoints.length - 1] ?? null;
    const { change, rangeChange } = seriesDelta(chartPoints);

    series.push({
      id,
      label: spec.label,
      unit: spec.unit,
      latest: latestPoint?.value ?? null,
      asOf: latestPoint?.date ?? null,
      change,
      rangeChange,
      points: chartPoints,
      context: spec.id === "CPI" ? cpiYoyContext(points) : null,
      periodKind: spec.periodKind,
    });
  }

  return { countryCode: "US", series };
}
