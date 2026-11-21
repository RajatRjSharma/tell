import type { Client } from "@libsql/client";
import { horizonToBars } from "@/lib/signals/horizons";
import { periodChanges } from "./changes";
import { listCompanySnapshots } from "./company-snapshots";
import {
  buildMapViews,
  type MapInputs,
  type MapView,
  priceSymbols,
  referenceRequests,
  type PriceInfo,
} from "./views";

export type MarketMap = { asOf: string | null; views: MapView[] };

const RECENT_BARS = horizonToBars("1m") + 1;

export async function loadMapInputs(db: Client): Promise<MapInputs> {
  const symbols = priceSymbols();
  const refs = referenceRequests();

  const [recent, refRows, snapshots] = await Promise.all([
    db.batch(
      symbols.map((symbol) => ({
        sql: `SELECT date, close FROM asset_readings
              WHERE symbol = ? ORDER BY date DESC LIMIT ?`,
        args: [symbol, RECENT_BARS],
      })),
      "read",
    ),
    db.batch(
      refs.map(({ symbol, date }) => ({
        // On or before the date; else the first bar after (history may start later).
        sql: `SELECT close FROM (
                SELECT close, 0 AS pick FROM (
                  SELECT close FROM asset_readings
                  WHERE symbol = ? AND date <= ? ORDER BY date DESC LIMIT 1)
                UNION ALL
                SELECT close, 1 AS pick FROM (
                  SELECT close FROM asset_readings
                  WHERE symbol = ? AND date > ? ORDER BY date ASC LIMIT 1)
              ) ORDER BY pick LIMIT 1`,
        args: [symbol, date, symbol, date],
      })),
      "read",
    ),
    listCompanySnapshots(db),
  ]);

  const prices: Record<string, PriceInfo> = {};
  let asOf = "";
  symbols.forEach((symbol, index) => {
    const rows = [...recent[index]!.rows].reverse();
    const last = rows.at(-1);
    if (!last) return;
    const date = String(last.date);
    if (date > asOf) asOf = date;
    prices[symbol] = {
      close: Number(last.close),
      changes: periodChanges(rows.map((row) => Number(row.close))),
      refCloses: {},
    };
  });
  refs.forEach(({ symbol, date }, index) => {
    const close = refRows[index]!.rows[0]?.close;
    if (prices[symbol] && close != null) {
      prices[symbol].refCloses[date] = Number(close);
    }
  });

  return { asOf, prices, companies: snapshots };
}

export async function getMarketMap(db: Client): Promise<MarketMap> {
  const inputs = await loadMapInputs(db);
  return { asOf: inputs.asOf || null, views: buildMapViews(inputs) };
}
