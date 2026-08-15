import { describe, expect, it } from "vitest";
import {
  addWatchlistItem,
  assetExists,
  listWatchlist,
  normalizeWatchSymbol,
  removeWatchlistItem,
} from "@/lib/watchlist/store";

describe("normalizeWatchSymbol", () => {
  it("uppercases and validates", () => {
    expect(normalizeWatchSymbol(" spy ")).toBe("SPY");
    expect(normalizeWatchSymbol("EURUSD")).toBe("EURUSD");
    expect(normalizeWatchSymbol("")).toBeNull();
    expect(normalizeWatchSymbol("bad symbol!")).toBeNull();
  });
});

describe("watchlist store queries", () => {
  it("lists, adds, and removes symbols for a user", async () => {
    const rows: { user_id: string; symbol: string; created_at: string }[] = [];
    const assets = new Set(["SPY", "TLT", "GLD"]);

    const db = {
      async execute(query: { sql: string; args?: unknown[] }) {
        const sql = query.sql.replace(/\s+/g, " ").trim();
        const args = query.args ?? [];

        if (sql.startsWith("SELECT symbol FROM watchlist_items")) {
          const userId = String(args[0]);
          return {
            rows: rows
              .filter((row) => row.user_id === userId)
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((row) => ({ symbol: row.symbol })),
          };
        }

        if (sql.startsWith("SELECT 1 AS ok FROM assets")) {
          const symbol = String(args[0]);
          return { rows: assets.has(symbol) ? [{ ok: 1 }] : [] };
        }

        if (sql.startsWith("INSERT INTO watchlist_items")) {
          const userId = String(args[0]);
          const symbol = String(args[1]);
          if (
            !rows.some((row) => row.user_id === userId && row.symbol === symbol)
          ) {
            rows.push({
              user_id: userId,
              symbol,
              created_at: `2026-08-15T00:0${rows.length}:00Z`,
            });
          }
          return { rows: [] };
        }

        if (sql.startsWith("DELETE FROM watchlist_items")) {
          const userId = String(args[0]);
          const symbol = String(args[1]);
          const index = rows.findIndex(
            (row) => row.user_id === userId && row.symbol === symbol,
          );
          if (index >= 0) rows.splice(index, 1);
          return { rows: [] };
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };

    expect(await assetExists(db as never, "SPY")).toBe(true);
    expect(await assetExists(db as never, "ZZZ")).toBe(false);

    expect(await listWatchlist(db as never, "user-1")).toEqual([]);

    expect(await addWatchlistItem(db as never, "user-1", "SPY")).toEqual([
      "SPY",
    ]);
    expect(await addWatchlistItem(db as never, "user-1", "TLT")).toEqual([
      "SPY",
      "TLT",
    ]);
    expect(await addWatchlistItem(db as never, "user-1", "SPY")).toEqual([
      "SPY",
      "TLT",
    ]);
    expect(await addWatchlistItem(db as never, "user-2", "GLD")).toEqual([
      "GLD",
    ]);

    expect(await removeWatchlistItem(db as never, "user-1", "SPY")).toEqual([
      "TLT",
    ]);
    expect(await listWatchlist(db as never, "user-1")).toEqual(["TLT"]);
  });
});
