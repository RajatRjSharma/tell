import type { Client } from "@libsql/client";
import { assets, countries, indicators } from "@/data/seed";

/** Symbols removed from the universe → replacement symbol. */
export const RETIRED_SYMBOLS: Record<string, string> = {
  // Yahoo's offshore CNH history is effectively empty; onshore CNY is complete.
  USDCNH: "USDCNY",
};

/** Upsert countries, indicators and assets from `src/data/seed.ts`. */
export async function syncCatalog(db: Client): Promise<void> {
  for (const c of countries) {
    await db.execute({
      sql: `INSERT INTO countries (code, name, region, currency)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
              name = excluded.name,
              region = excluded.region,
              currency = excluded.currency`,
      args: [c.code, c.name, c.region, c.currency],
    });
  }

  for (const i of indicators) {
    await db.execute({
      sql: `INSERT INTO indicators (id, name, unit, frequency, source, source_series_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              unit = excluded.unit,
              frequency = excluded.frequency,
              source = excluded.source,
              source_series_id = excluded.source_series_id,
              description = excluded.description`,
      args: [
        i.id,
        i.name,
        i.unit,
        i.frequency,
        i.source,
        i.source_series_id,
        i.description,
      ],
    });
  }

  for (const a of assets) {
    await db.execute({
      sql: `INSERT INTO assets (symbol, name, asset_class, country_code, currency, source_symbol)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
              name = excluded.name,
              asset_class = excluded.asset_class,
              country_code = excluded.country_code,
              currency = excluded.currency,
              source_symbol = excluded.source_symbol`,
      args: [
        a.symbol,
        a.name,
        a.asset_class,
        a.country_code,
        a.currency,
        a.source_symbol,
      ],
    });
  }
}

/**
 * Move user-owned rows (watchlist, alerts) to the replacement symbol and drop
 * derived data for retired symbols. Safe to run repeatedly.
 */
export async function retireSymbols(
  db: Client,
  retired: Record<string, string> = RETIRED_SYMBOLS,
): Promise<string[]> {
  const changed: string[] = [];

  for (const [oldSymbol, newSymbol] of Object.entries(retired)) {
    const exists = await db.execute({
      sql: "SELECT 1 FROM assets WHERE symbol = ?",
      args: [oldSymbol],
    });
    if (exists.rows.length === 0) continue;

    await db.batch(
      [
        {
          sql: "UPDATE OR IGNORE watchlist_items SET symbol = ? WHERE symbol = ?",
          args: [newSymbol, oldSymbol],
        },
        {
          sql: "DELETE FROM watchlist_items WHERE symbol = ?",
          args: [oldSymbol],
        },
        {
          sql: "UPDATE alert_rules SET symbol = ? WHERE symbol = ?",
          args: [newSymbol, oldSymbol],
        },
        {
          sql: "UPDATE alert_events SET symbol = ? WHERE symbol = ?",
          args: [newSymbol, oldSymbol],
        },
        ...["asset_readings", "signals", "forecast_log", "research_briefs"].map(
          (table) => ({
            sql: `DELETE FROM ${table} WHERE symbol = ?`,
            args: [oldSymbol],
          }),
        ),
        { sql: "DELETE FROM assets WHERE symbol = ?", args: [oldSymbol] },
      ],
      "write",
    );
    changed.push(`${oldSymbol}→${newSymbol}`);
  }

  return changed;
}
