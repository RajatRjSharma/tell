import type { Client } from "@libsql/client";
import { assets } from "@/data/seed";
import {
  buildFeatureSnapshotFromCache,
  listTradingDates,
  preloadFeatureSeries,
} from "@/lib/features";
import { parseHorizons } from "@/lib/signals/horizons";
import { scoreSignal, type ScoredSignal } from "@/lib/signals/score";
import { toSignalUpsert, upsertSignals } from "@/lib/signals/store";

export type BackfillSignalsResult = {
  dates: string[];
  written: number;
  signalsPerDay: number;
};

/**
 * Walk recent trading days and upsert historical signals.
 * Preloads series once so each asOf is in-memory point-in-time scoring.
 */
export async function backfillHistoricalSignals(
  db: Client,
  options?: {
    days?: number;
    from?: string | null;
    to?: string | null;
    symbols?: string[];
    horizons?: string[];
    calendarSymbol?: string;
  },
): Promise<BackfillSignalsResult> {
  const universe = options?.symbols?.length
    ? assets.filter((asset) => options.symbols!.includes(asset.symbol))
    : [...assets];

  if (universe.length === 0) {
    throw new Error("No assets selected for signal backfill");
  }

  const horizons =
    options?.horizons ?? parseHorizons(process.env.SIGNAL_HORIZONS);
  const symbols = universe.map((asset) => asset.symbol);
  const classBySymbol = new Map(
    universe.map((asset) => [asset.symbol, asset.asset_class]),
  );
  const calendarSymbol = options?.calendarSymbol ?? symbols[0] ?? "SPY";
  const days = options?.days ?? 60;

  const dates = await listTradingDates(db, calendarSymbol, {
    from: options?.from ?? null,
    to: options?.to ?? null,
    limit: options?.from || options?.to ? null : days,
  });

  if (dates.length === 0) {
    throw new Error(
      `No trading dates found for ${calendarSymbol} — run market ingest first`,
    );
  }

  const cache = await preloadFeatureSeries(db, symbols);
  let written = 0;
  let signalsPerDay = 0;

  for (const asOf of dates) {
    const snapshot = buildFeatureSnapshotFromCache(cache, asOf, symbols);
    const marketBySymbol = new Map(
      snapshot.markets.map((market) => [market.symbol, market]),
    );
    const signals: ScoredSignal[] = [];

    for (const symbol of symbols) {
      const market = marketBySymbol.get(symbol);
      const assetClass = classBySymbol.get(symbol);
      if (!market || !assetClass) continue;

      for (const horizon of horizons) {
        signals.push(
          scoreSignal({
            symbol,
            assetClass,
            horizon,
            asOfDate: snapshot.asOf,
            regime: snapshot.regime.regime,
            market,
          }),
        );
      }
    }

    signalsPerDay = signals.length;
    written += await upsertSignals(db, signals.map(toSignalUpsert));
  }

  return { dates, written, signalsPerDay };
}
