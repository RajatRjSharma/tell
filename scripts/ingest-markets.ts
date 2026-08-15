import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { assets } from "../src/data/seed";
import { fetchYahooDailyBars, unixSeconds } from "../src/lib/yahoo";
import {
  toAssetReadingUpserts,
  upsertAssetReadings,
} from "../src/lib/asset-readings";

config({ path: resolve(process.cwd(), ".env") });

async function ingestMarkets() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const startIso = process.env.MARKET_OBSERVATION_START ?? "2023-01-01";
  const fromUnix = unixSeconds(new Date(`${startIso}T00:00:00.000Z`));
  const toUnix = unixSeconds(new Date());

  const db = createClient({ url, authToken });

  console.log(
    `Ingesting ${assets.length} assets from Yahoo Finance (from ${startIso})...`,
  );

  let total = 0;

  for (const asset of assets) {
    process.stdout.write(
      `  ${asset.symbol} (${asset.source_symbol}, ${asset.asset_class})... `,
    );

    try {
      const bars = await fetchYahooDailyBars(
        asset.source_symbol,
        fromUnix,
        toUnix,
      );
      const rows = toAssetReadingUpserts(asset.symbol, bars);
      const written = await upsertAssetReadings(db, rows);
      total += written;
      console.log(`${written} bars`);
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      throw err;
    }

    // Be polite to Yahoo chart endpoints
    await new Promise((r) => setTimeout(r, 400));
  }

  const count = await db.execute(`SELECT COUNT(*) AS n FROM asset_readings`);

  console.log(`Done. Wrote ${total} upserts.`);
  console.log(`asset_readings in DB: ${count.rows[0]?.n ?? 0}`);
}

ingestMarkets().catch((err) => {
  console.error(err);
  process.exit(1);
});
