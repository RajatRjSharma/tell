import type { Client } from "@libsql/client";
import { assets } from "@/data/seed";
import { buildFeatureSnapshot } from "@/lib/features";
import { parseHorizons } from "./horizons";
import { scoreSignal, type ScoredSignal } from "./score";
import { toSignalUpsert, upsertSignals } from "./store";

export async function computeAndStoreSignals(
  db: Client,
  options?: {
    asOf?: string;
    symbols?: string[];
    horizons?: string[];
  },
): Promise<{ asOf: string; signals: ScoredSignal[]; written: number }> {
  const universe = options?.symbols?.length
    ? assets.filter((a) => options.symbols!.includes(a.symbol))
    : [...assets];

  if (universe.length === 0) {
    throw new Error("No assets selected for signal compute");
  }

  const horizons =
    options?.horizons ?? parseHorizons(process.env.SIGNAL_HORIZONS);
  const symbols = universe.map((a) => a.symbol);
  const classBySymbol = new Map(universe.map((a) => [a.symbol, a.asset_class]));

  const snapshot = await buildFeatureSnapshot(db, {
    asOf: options?.asOf,
    symbols,
  });

  const marketBySymbol = new Map(snapshot.markets.map((m) => [m.symbol, m]));
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

  const written = await upsertSignals(db, signals.map(toSignalUpsert));
  return { asOf: snapshot.asOf, signals, written };
}
