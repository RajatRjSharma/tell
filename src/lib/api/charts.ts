import type { Client } from "@libsql/client";
import {
  seriesChangePct,
  type ChartBar,
  type ChartSignalMarker,
} from "@/lib/charts/geometry";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export type { ChartBar, ChartSignalMarker };
export { buildChartGeometry, seriesChangePct } from "@/lib/charts/geometry";

export type ChartSeries = {
  symbol: string;
  from: string | null;
  to: string | null;
  bars: ChartBar[];
  signals: ChartSignalMarker[];
  changePct: number | null;
};

export async function listChartBars(
  db: Client,
  options: {
    symbol: string;
    from?: string | null;
    to?: string | null;
    limit: number;
  },
): Promise<ChartBar[]> {
  const filters = ["symbol = ?"];
  const args: Array<string | number> = [options.symbol];

  if (options.from) {
    filters.push("date >= ?");
    args.push(options.from);
  }
  if (options.to) {
    filters.push("date <= ?");
    args.push(options.to);
  }

  args.push(options.limit);

  const result = await db.execute({
    sql: `SELECT date, open, high, low, close, volume
          FROM asset_readings
          WHERE ${filters.join(" AND ")}
          ORDER BY date DESC
          LIMIT ?`,
    args,
  });

  return result.rows
    .map((row) => ({
      date: String(row.date),
      open: row.open == null ? null : Number(row.open),
      high: row.high == null ? null : Number(row.high),
      low: row.low == null ? null : Number(row.low),
      close: Number(row.close),
      volume: row.volume == null ? null : Number(row.volume),
    }))
    .reverse();
}

export async function listChartSignals(
  db: Client,
  options: {
    symbol: string;
    from?: string | null;
    to?: string | null;
    horizon?: string | null;
    modelVersion?: string;
  },
): Promise<ChartSignalMarker[]> {
  const filters = ["symbol = ?", "model_version = ?"];
  const args: Array<string | number> = [
    options.symbol,
    options.modelVersion ?? SIGNAL_MODEL_VERSION,
  ];

  if (options.from) {
    filters.push("as_of_date >= ?");
    args.push(options.from);
  }
  if (options.to) {
    filters.push("as_of_date <= ?");
    args.push(options.to);
  }
  if (options.horizon) {
    filters.push("horizon = ?");
    args.push(options.horizon);
  }

  const result = await db.execute({
    sql: `SELECT as_of_date, horizon, direction, score, confidence
          FROM signals
          WHERE ${filters.join(" AND ")}
          ORDER BY as_of_date ASC`,
    args,
  });

  return result.rows.map((row) => ({
    date: String(row.as_of_date),
    horizon: String(row.horizon),
    direction: String(row.direction),
    score: Number(row.score),
    confidence: row.confidence == null ? null : Number(row.confidence),
  }));
}

export async function getChartSeries(
  db: Client,
  options: {
    symbol: string;
    from?: string | null;
    to?: string | null;
    limit?: number;
    horizon?: string | null;
  },
): Promise<ChartSeries> {
  const symbol = options.symbol.trim().toUpperCase();
  const bars = await listChartBars(db, {
    symbol,
    from: options.from,
    to: options.to,
    limit: options.limit ?? 90,
  });

  const from = bars[0]?.date ?? options.from ?? null;
  const to = bars[bars.length - 1]?.date ?? options.to ?? null;

  const signals = await listChartSignals(db, {
    symbol,
    from,
    to,
    horizon: options.horizon ?? null,
  });

  return {
    symbol,
    from,
    to,
    bars,
    signals,
    changePct: seriesChangePct(bars),
  };
}
