import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { assets } from "../src/data/seed";
import { computeAndStoreSignals } from "../src/lib/signals";
import { parseHorizons } from "../src/lib/signals/horizons";
import { fetchLiveQuote } from "../src/lib/quotes";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const horizons = parseHorizons(process.env.SIGNAL_HORIZONS);
  const db = createClient({ url, authToken });

  console.log(
    `Computing signals for ${assets.length} assets × ${horizons.join(",")}...`,
  );

  const { asOf, signals, written } = await computeAndStoreSignals(db, {
    asOf: process.env.SIGNAL_AS_OF,
    horizons,
  });

  console.log(`as_of=${asOf}  wrote=${written}  model=rules-v1`);
  console.log("");

  const byHorizon = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = byHorizon.get(s.horizon) ?? [];
    list.push(s);
    byHorizon.set(s.horizon, list);
  }

  for (const horizon of horizons) {
    console.log(`--- ${horizon} ---`);
    const rows = (byHorizon.get(horizon) ?? []).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    );
    for (const s of rows) {
      const drivers = s.drivers
        .slice(0, 2)
        .map((d) => d.detail)
        .join(" · ");
      console.log(
        `  ${s.symbol.padEnd(8)} ${s.direction.padEnd(8)} score=${s.score.toFixed(2)}  conf=${s.confidence.toFixed(2)}  [${s.regime}]  ${drivers}`,
      );
    }
    console.log("");
  }

  const liveSymbols = (process.env.LIVE_QUOTE_SYMBOLS ?? "SPY,GLD,TLT")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (liveSymbols.length > 0) {
    console.log("Live quotes (near real-time overlay; not used in score):");
    for (const symbol of liveSymbols) {
      const asset = assets.find((a) => a.symbol === symbol);
      if (!asset) continue;
      try {
        const q = await fetchLiveQuote(symbol, asset.source_symbol);
        if (!q) {
          console.log(`  ${symbol.padEnd(8)} unavailable`);
          continue;
        }
        const ch =
          q.changePercent == null
            ? ""
            : `  day=${(q.changePercent * 100).toFixed(2)}%`;
        console.log(
          `  ${symbol.padEnd(8)} ${q.price.toFixed(2)}  via ${q.source}${ch}`,
        );
      } catch {
        console.log(`  ${symbol.padEnd(8)} error`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  const count = await db.execute(`SELECT COUNT(*) AS n FROM signals`);
  console.log("");
  console.log(`signals in DB: ${count.rows[0]?.n ?? 0}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
