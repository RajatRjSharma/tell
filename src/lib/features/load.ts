import type { Client } from "@libsql/client";
import { CURRENT_VINTAGE } from "@/lib/readings";
import type { SeriesPoint } from "./series";

export async function loadMacroSeries(
  db: Client,
  countryCode: string,
  indicatorId: string,
): Promise<SeriesPoint[]> {
  const result = await db.execute({
    sql: `SELECT observed_for AS date, value
          FROM readings
          WHERE country_code = ?
            AND indicator_id = ?
            AND vintage = ?
          ORDER BY observed_for ASC`,
    args: [countryCode, indicatorId, CURRENT_VINTAGE],
  });

  return result.rows.map((row) => ({
    date: String(row.date),
    value: Number(row.value),
  }));
}

export async function loadAssetCloses(
  db: Client,
  symbol: string,
): Promise<SeriesPoint[]> {
  const result = await db.execute({
    sql: `SELECT date, close AS value
          FROM asset_readings
          WHERE symbol = ?
          ORDER BY date ASC`,
    args: [symbol],
  });

  return result.rows.map((row) => ({
    date: String(row.date),
    value: Number(row.value),
  }));
}

export async function latestAssetDate(
  db: Client,
  symbol: string,
): Promise<string | null> {
  const result = await db.execute({
    sql: `SELECT date FROM asset_readings WHERE symbol = ? ORDER BY date DESC LIMIT 1`,
    args: [symbol],
  });
  const date = result.rows[0]?.date;
  return date == null ? null : String(date);
}

/** Trading days from asset_readings (newest last), optionally bounded. */
export async function listTradingDates(
  db: Client,
  symbol: string,
  options?: {
    from?: string | null;
    to?: string | null;
    limit?: number | null;
  },
): Promise<string[]> {
  const filters = ["symbol = ?"];
  const args: Array<string | number> = [symbol];

  if (options?.from) {
    filters.push("date >= ?");
    args.push(options.from);
  }
  if (options?.to) {
    filters.push("date <= ?");
    args.push(options.to);
  }

  const limit =
    options?.limit == null
      ? null
      : Math.min(Math.max(Math.floor(options.limit), 1), 5000);

  // When limited, take the most recent N days then return ascending.
  const sql =
    limit == null
      ? `SELECT date FROM asset_readings
         WHERE ${filters.join(" AND ")}
         ORDER BY date ASC`
      : `SELECT date FROM (
           SELECT date FROM asset_readings
           WHERE ${filters.join(" AND ")}
           ORDER BY date DESC
           LIMIT ?
         ) recent
         ORDER BY date ASC`;

  if (limit != null) args.push(limit);

  const result = await db.execute({ sql, args });
  return result.rows.map((row) => String(row.date));
}
