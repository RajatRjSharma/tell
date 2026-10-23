import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { assets } from "../src/data/seed";
import { fetchYahooDailyBars, unixSeconds } from "../src/lib/yahoo";
import {
  latestAssetBarDate,
  toAssetReadingUpserts,
  upsertAssetReadings,
} from "../src/lib/asset-readings";
import {
  fullRefreshRequested,
  incrementalStart,
} from "../src/lib/ingest/incremental";
import { assertFailureBudget, runIsolated } from "../src/lib/ingest/run";

config({ path: resolve(process.cwd(), ".env") });

/** Re-read the last couple of weeks to pick up late corrections. */
const BAR_OVERLAP_DAYS = 14;

async function ingestMarkets() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const startIso = process.env.MARKET_OBSERVATION_START ?? "2023-01-01";
  const fullRefresh = fullRefreshRequested();
  const toUnix = unixSeconds(new Date());

  const db = createClient({ url, authToken });

  console.log(
    `Ingesting ${assets.length} assets from Yahoo Finance (${fullRefresh ? `full from ${startIso}` : "incremental"})...`,
  );

  const run = await runIsolated(
    assets,
    (asset) => `${asset.symbol} (${asset.source_symbol}, ${asset.asset_class})`,
    async (asset) => {
      const start = fullRefresh
        ? startIso
        : incrementalStart(
            await latestAssetBarDate(db, asset.symbol),
            startIso,
            BAR_OVERLAP_DAYS,
          );
      const bars = await fetchYahooDailyBars(
        asset.source_symbol,
        unixSeconds(new Date(`${start}T00:00:00.000Z`)),
        toUnix,
      );
      return upsertAssetReadings(db, toAssetReadingUpserts(asset.symbol, bars));
    },
    { pauseMs: 400 },
  );

  const count = await db.execute(`SELECT COUNT(*) AS n FROM asset_readings`);

  console.log(
    `Done. Wrote ${run.written} upserts; ${run.failed.length} symbols failed.`,
  );
  console.log(`asset_readings in DB: ${count.rows[0]?.n ?? 0}`);
  assertFailureBudget("ingest:markets", run);
}

ingestMarkets().catch((err) => {
  console.error(err);
  process.exit(1);
});
