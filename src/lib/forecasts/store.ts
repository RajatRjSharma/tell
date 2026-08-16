import type { Client } from "@libsql/client";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";
import { summarizeOutcomes, type QualityStats } from "@/lib/forecasts/evaluate";

export type ForecastRow = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  direction: string;
  score: number | null;
  confidence: number | null;
  actualReturn: number | null;
  correct: number | null;
  modelVersion: string;
  evaluatedAt: string | null;
};

export type ForecastUpsert = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  direction: string;
  score: number | null;
  confidence: number | null;
  actualReturn: number;
  correct: boolean;
  modelVersion: string;
};

export async function upsertForecasts(
  db: Client,
  rows: ForecastUpsert[],
): Promise<number> {
  let written = 0;
  for (const row of rows) {
    await db.execute({
      sql: `INSERT INTO forecast_log (
              symbol, horizon, as_of_date, direction, score, confidence,
              actual_return, correct, model_version, evaluated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(symbol, horizon, as_of_date, model_version)
            DO UPDATE SET
              direction = excluded.direction,
              score = excluded.score,
              confidence = excluded.confidence,
              actual_return = excluded.actual_return,
              correct = excluded.correct,
              evaluated_at = datetime('now')`,
      args: [
        row.symbol,
        row.horizon,
        row.asOfDate,
        row.direction,
        row.score,
        row.confidence,
        row.actualReturn,
        row.correct ? 1 : 0,
        row.modelVersion,
      ],
    });
    written += 1;
  }
  return written;
}

function mapRow(row: Record<string, unknown>): ForecastRow {
  return {
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    asOfDate: String(row.as_of_date),
    direction: String(row.direction),
    score: row.score == null ? null : Number(row.score),
    confidence: row.confidence == null ? null : Number(row.confidence),
    actualReturn: row.actual_return == null ? null : Number(row.actual_return),
    correct: row.correct == null ? null : Number(row.correct),
    modelVersion: String(row.model_version ?? SIGNAL_MODEL_VERSION),
    evaluatedAt: row.evaluated_at == null ? null : String(row.evaluated_at),
  };
}

export async function listForecasts(
  db: Client,
  options?: {
    symbol?: string | null;
    symbols?: string[] | null;
    horizon?: string | null;
    modelVersion?: string;
    limit?: number;
  },
): Promise<ForecastRow[]> {
  const filters = ["model_version = ?"];
  const args: Array<string | number> = [
    options?.modelVersion ?? SIGNAL_MODEL_VERSION,
  ];

  if (options?.symbol) {
    filters.push("symbol = ?");
    args.push(options.symbol.trim().toUpperCase());
  } else if (options?.symbols?.length) {
    const symbols = [
      ...new Set(options.symbols.map((symbol) => symbol.trim().toUpperCase())),
    ].filter(Boolean);
    if (symbols.length > 0) {
      filters.push(`symbol IN (${symbols.map(() => "?").join(",")})`);
      args.push(...symbols);
    }
  }
  if (options?.horizon) {
    filters.push("horizon = ?");
    args.push(options.horizon.toLowerCase());
  }

  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 2000);
  args.push(limit);

  const result = await db.execute({
    sql: `SELECT symbol, horizon, as_of_date, direction, score, confidence,
                 actual_return, correct, model_version, evaluated_at
          FROM forecast_log
          WHERE ${filters.join(" AND ")}
          ORDER BY as_of_date DESC, symbol ASC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export type QualityReport = {
  modelVersion: string;
  overall: QualityStats;
  byHorizon: Record<string, QualityStats>;
  bySymbol: Record<string, QualityStats>;
  recent: ForecastRow[];
};

export async function getQualityReport(
  db: Client,
  options?: {
    symbol?: string | null;
    symbols?: string[] | null;
    modelVersion?: string;
    recentLimit?: number;
  },
): Promise<QualityReport> {
  const modelVersion = options?.modelVersion ?? SIGNAL_MODEL_VERSION;
  const rows = await listForecasts(db, {
    symbol: options?.symbol,
    symbols: options?.symbols,
    modelVersion,
    limit: 2000,
  });

  const byHorizon: Record<string, QualityStats> = {};
  const bySymbol: Record<string, QualityStats> = {};

  const horizons = [...new Set(rows.map((row) => row.horizon))];
  for (const horizon of horizons) {
    byHorizon[horizon] = summarizeOutcomes(
      rows.filter((row) => row.horizon === horizon),
    );
  }

  const symbols = [...new Set(rows.map((row) => row.symbol))];
  for (const symbol of symbols) {
    bySymbol[symbol] = summarizeOutcomes(
      rows.filter((row) => row.symbol === symbol),
    );
  }

  return {
    modelVersion,
    overall: summarizeOutcomes(rows),
    byHorizon,
    bySymbol,
    recent: rows.slice(0, options?.recentLimit ?? 12),
  };
}
