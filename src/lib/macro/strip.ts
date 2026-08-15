import type { Client } from "@libsql/client";
import { listReadings } from "@/lib/api/readings-query";
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

export async function getMacroStrip(
  db: Client,
  options?: { limit?: number },
): Promise<MacroStrip> {
  const limit = Math.min(Math.max(options?.limit ?? 24, 6), 120);
  const series: MacroSparkSeries[] = [];

  for (const spec of MACRO_STRIP_SPECS) {
    let points = await loadSparkPoints(db, spec.id, limit);
    let id: string = spec.id;

    if (points.length === 0) {
      for (const fallback of spec.fallbackIds) {
        points = await loadSparkPoints(db, fallback, limit);
        if (points.length > 0) {
          id = fallback;
          break;
        }
      }
    }

    const latestPoint = points[points.length - 1] ?? null;
    const { change, rangeChange } = seriesDelta(points);

    series.push({
      id,
      label: spec.label,
      unit: spec.unit,
      latest: latestPoint?.value ?? null,
      asOf: latestPoint?.date ?? null,
      change,
      rangeChange,
      points,
    });
  }

  return { countryCode: "US", series };
}
