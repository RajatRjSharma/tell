import type { Client } from "@libsql/client";
import type { ScoredSignal } from "./score";

export type SignalUpsert = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  score: number;
  direction: string;
  confidence: number;
  driversJson: string;
  regime: string;
  modelVersion: string;
};

export function toSignalUpsert(signal: ScoredSignal): SignalUpsert {
  return {
    symbol: signal.symbol,
    horizon: signal.horizon,
    asOfDate: signal.asOfDate,
    score: signal.score,
    direction: signal.direction,
    confidence: signal.confidence,
    driversJson: JSON.stringify(signal.drivers),
    regime: signal.regime,
    modelVersion: signal.modelVersion,
  };
}

export async function upsertSignals(
  db: Client,
  rows: SignalUpsert[],
  batchSize = 40,
): Promise<number> {
  if (rows.length === 0) return 0;

  let written = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch
      .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .join(", ");
    const args = batch.flatMap((row) => [
      row.symbol,
      row.horizon,
      row.asOfDate,
      row.score,
      row.direction,
      row.confidence,
      row.driversJson,
      row.regime,
      row.modelVersion,
    ]);

    await db.execute({
      sql: `INSERT INTO signals (
              symbol, horizon, as_of_date, score, direction, confidence,
              drivers_json, regime, model_version
            ) VALUES ${placeholders}
            ON CONFLICT(symbol, horizon, as_of_date, model_version)
            DO UPDATE SET
              score = excluded.score,
              direction = excluded.direction,
              confidence = excluded.confidence,
              drivers_json = excluded.drivers_json,
              regime = excluded.regime,
              created_at = datetime('now')`,
      args,
    });
    written += batch.length;
  }
  return written;
}
