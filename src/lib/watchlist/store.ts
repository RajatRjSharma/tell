import type { Client } from "@libsql/client";

const SYMBOL_RE = /^[A-Z0-9.=_-]{1,20}$/;

export function normalizeWatchSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  if (!symbol || !SYMBOL_RE.test(symbol)) return null;
  return symbol;
}

export async function listWatchlist(
  db: Client,
  userId: string,
): Promise<string[]> {
  const result = await db.execute({
    sql: `SELECT symbol FROM watchlist_items
          WHERE user_id = ?
          ORDER BY created_at ASC, symbol ASC`,
    args: [userId],
  });

  return result.rows.map((row) => String(row.symbol));
}

export async function assetExists(
  db: Client,
  symbol: string,
): Promise<boolean> {
  const result = await db.execute({
    sql: "SELECT 1 AS ok FROM assets WHERE symbol = ? LIMIT 1",
    args: [symbol],
  });
  return result.rows.length > 0;
}

export async function addWatchlistItem(
  db: Client,
  userId: string,
  symbol: string,
): Promise<string[]> {
  await db.execute({
    sql: `INSERT INTO watchlist_items (user_id, symbol)
          VALUES (?, ?)
          ON CONFLICT(user_id, symbol) DO NOTHING`,
    args: [userId, symbol],
  });
  return listWatchlist(db, userId);
}

export async function removeWatchlistItem(
  db: Client,
  userId: string,
  symbol: string,
): Promise<string[]> {
  await db.execute({
    sql: `DELETE FROM watchlist_items
          WHERE user_id = ? AND symbol = ?`,
    args: [userId, symbol],
  });
  return listWatchlist(db, userId);
}
