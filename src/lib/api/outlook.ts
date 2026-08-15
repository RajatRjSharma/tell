import type { Client } from "@libsql/client";
import { SIGNAL_MODEL_VERSION, type SignalDriver } from "@/lib/signals/score";

export type OutlookSignalDto = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  score: number;
  direction: string;
  confidence: number | null;
  drivers: SignalDriver[];
  regime: string | null;
  modelVersion: string;
};

function parseDrivers(raw: unknown): SignalDriver[] {
  if (raw == null) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is SignalDriver =>
        d != null &&
        typeof d === "object" &&
        typeof (d as SignalDriver).code === "string" &&
        typeof (d as SignalDriver).detail === "string",
    );
  } catch {
    return [];
  }
}

function rowToDto(row: Record<string, unknown>): OutlookSignalDto {
  return {
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    asOfDate: String(row.as_of_date),
    score: Number(row.score),
    direction: String(row.direction),
    confidence: row.confidence == null ? null : Number(row.confidence),
    drivers: parseDrivers(row.drivers_json),
    regime: row.regime == null ? null : String(row.regime),
    modelVersion: String(row.model_version),
  };
}

/**
 * Latest signal row per (symbol, horizon) for the given model version.
 */
export async function listLatestOutlook(
  db: Client,
  options?: {
    asOfDate?: string | null;
    symbols?: string[] | null;
    horizons?: string[] | null;
    modelVersion?: string;
  },
): Promise<OutlookSignalDto[]> {
  const modelVersion = options?.modelVersion ?? SIGNAL_MODEL_VERSION;
  const args: Array<string | number> = [];
  const filters: string[] = ["s.model_version = ?"];
  args.push(modelVersion);

  if (options?.asOfDate) {
    filters.push("s.as_of_date = ?");
    args.push(options.asOfDate);
  }

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

  const where = filters.join(" AND ");

  const sql = options?.asOfDate
    ? `SELECT s.symbol, s.horizon, s.as_of_date, s.score, s.direction,
              s.confidence, s.drivers_json, s.regime, s.model_version
       FROM signals s
       WHERE ${where}
       ORDER BY s.symbol ASC, s.horizon ASC`
    : `SELECT s.symbol, s.horizon, s.as_of_date, s.score, s.direction,
              s.confidence, s.drivers_json, s.regime, s.model_version
       FROM signals s
       INNER JOIN (
         SELECT symbol, horizon, MAX(as_of_date) AS max_as_of
         FROM signals
         WHERE model_version = ?
         GROUP BY symbol, horizon
       ) latest
         ON latest.symbol = s.symbol
        AND latest.horizon = s.horizon
        AND latest.max_as_of = s.as_of_date
       WHERE ${where}
       ORDER BY s.symbol ASC, s.horizon ASC`;

  const finalArgs = options?.asOfDate ? args : [modelVersion, ...args];

  const result = await db.execute({ sql, args: finalArgs });
  return result.rows.map((row) => rowToDto(row as Record<string, unknown>));
}

export async function getLatestAsOfDate(
  db: Client,
  modelVersion = SIGNAL_MODEL_VERSION,
): Promise<string | null> {
  const result = await db.execute({
    sql: `SELECT MAX(as_of_date) AS d FROM signals WHERE model_version = ?`,
    args: [modelVersion],
  });
  const d = result.rows[0]?.d;
  return d == null ? null : String(d);
}

export function groupOutlookBySymbol(
  rows: OutlookSignalDto[],
): Record<string, OutlookSignalDto[]> {
  const out: Record<string, OutlookSignalDto[]> = {};
  for (const row of rows) {
    (out[row.symbol] ??= []).push(row);
  }
  return out;
}
