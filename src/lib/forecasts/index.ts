import type { Client } from "@libsql/client";
import { evaluateSignalOutcome } from "@/lib/forecasts/evaluate";
import { upsertForecasts, type ForecastUpsert } from "@/lib/forecasts/store";
import type { SeriesPoint } from "@/lib/features/series";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export type UnevaluatedSignal = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  direction: string;
  score: number | null;
  confidence: number | null;
  modelVersion: string;
};

export async function loadUnevaluatedSignals(
  db: Client,
  options?: {
    modelVersion?: string;
    symbols?: string[] | null;
    horizons?: string[] | null;
    limit?: number;
  },
): Promise<UnevaluatedSignal[]> {
  const modelVersion = options?.modelVersion ?? SIGNAL_MODEL_VERSION;
  const args: Array<string | number> = [modelVersion, modelVersion];
  const filters = ["s.model_version = ?"];

  if (options?.symbols?.length) {
    filters.push(`s.symbol IN (${options.symbols.map(() => "?").join(", ")})`);
    args.push(...options.symbols);
  }
  if (options?.horizons?.length) {
    filters.push(
      `s.horizon IN (${options.horizons.map(() => "?").join(", ")})`,
    );
    args.push(...options.horizons);
  }

  const limit = Math.min(Math.max(options?.limit ?? 5000, 1), 20000);
  args.push(limit);

  const result = await db.execute({
    sql: `SELECT s.symbol, s.horizon, s.as_of_date, s.direction, s.score,
                 s.confidence, s.model_version
          FROM signals s
          LEFT JOIN forecast_log f
            ON f.symbol = s.symbol
           AND f.horizon = s.horizon
           AND f.as_of_date = s.as_of_date
           AND f.model_version = ?
          WHERE ${filters.join(" AND ")}
            AND f.id IS NULL
          ORDER BY s.as_of_date ASC, s.symbol ASC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => ({
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    asOfDate: String(row.as_of_date),
    direction: String(row.direction),
    score: row.score == null ? null : Number(row.score),
    confidence: row.confidence == null ? null : Number(row.confidence),
    modelVersion: String(row.model_version),
  }));
}

export async function loadCloseSeries(
  db: Client,
  symbol: string,
): Promise<SeriesPoint[]> {
  const result = await db.execute({
    sql: `SELECT date, close
          FROM asset_readings
          WHERE symbol = ?
          ORDER BY date ASC`,
    args: [symbol],
  });

  return result.rows.map((row) => ({
    date: String(row.date),
    value: Number(row.close),
  }));
}

export async function computeAndStoreForecasts(
  db: Client,
  options?: {
    modelVersion?: string;
    symbols?: string[] | null;
    horizons?: string[] | null;
    limit?: number;
  },
): Promise<{ considered: number; written: number; skipped: number }> {
  const pending = await loadUnevaluatedSignals(db, options);
  const closesBySymbol = new Map<string, SeriesPoint[]>();
  const ready: ForecastUpsert[] = [];
  let skipped = 0;

  for (const signal of pending) {
    let closes = closesBySymbol.get(signal.symbol);
    if (!closes) {
      closes = await loadCloseSeries(db, signal.symbol);
      closesBySymbol.set(signal.symbol, closes);
    }

    const outcome = evaluateSignalOutcome(
      signal.direction,
      closes,
      signal.asOfDate,
      signal.horizon,
    );

    if (!outcome) {
      skipped += 1;
      continue;
    }

    ready.push({
      symbol: signal.symbol,
      horizon: signal.horizon,
      asOfDate: signal.asOfDate,
      direction: signal.direction,
      score: signal.score,
      confidence: signal.confidence,
      actualReturn: outcome.actualReturn,
      correct: outcome.correct,
      modelVersion: signal.modelVersion,
    });
  }

  const written = await upsertForecasts(db, ready);
  return { considered: pending.length, written, skipped };
}
