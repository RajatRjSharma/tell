import type { Client } from "@libsql/client";
import type { AssetBar } from "@/lib/yahoo";

export type AssetReadingUpsert = {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export function toAssetReadingUpserts(
  symbol: string,
  bars: AssetBar[],
): AssetReadingUpsert[] {
  return bars.map((bar) => ({
    symbol,
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
  }));
}

export async function upsertAssetReadings(
  db: Client,
  rows: AssetReadingUpsert[],
  batchSize = 100,
): Promise<number> {
  if (rows.length === 0) return 0;

  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const args = batch.flatMap((row) => [
      row.symbol,
      row.date,
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume,
    ]);

    await db.execute({
      sql: `INSERT INTO asset_readings (
              symbol, date, open, high, low, close, volume
            ) VALUES ${placeholders}
            ON CONFLICT(symbol, date) DO UPDATE SET
              open = excluded.open,
              high = excluded.high,
              low = excluded.low,
              close = excluded.close,
              volume = excluded.volume,
              fetched_at = datetime('now')`,
      args,
    });

    written += batch.length;
  }

  return written;
}
