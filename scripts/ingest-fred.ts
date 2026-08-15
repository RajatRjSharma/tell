import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { indicators } from "../src/data/seed";
import { fetchFredSeriesObservations } from "../src/lib/fred";
import { toReadingUpserts, upsertReadings } from "../src/lib/readings";

config({ path: resolve(process.cwd(), ".env") });

const DEFAULT_START = "2015-01-01";

async function ingestFred() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const observationStart = process.env.FRED_OBSERVATION_START ?? DEFAULT_START;

  const fredIndicators = indicators.filter((i) => i.source === "FRED");
  const db = createClient({ url, authToken });

  console.log(
    `Ingesting ${fredIndicators.length} FRED series (from ${observationStart})...`,
  );

  let total = 0;

  for (const indicator of fredIndicators) {
    const seriesId = indicator.source_series_id;
    process.stdout.write(`  ${indicator.id} (${seriesId})... `);

    try {
      const parsed = await fetchFredSeriesObservations(seriesId, {
        observationStart,
      });
      const rows = toReadingUpserts("US", indicator.id, "FRED", parsed);
      const written = await upsertReadings(db, rows);
      total += written;
      console.log(`${written} rows`);
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      throw err;
    }

    // Be polite to FRED free tier
    await new Promise((r) => setTimeout(r, 200));
  }

  const count = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM readings WHERE source = ? AND country_code = ?`,
    args: ["FRED", "US"],
  });

  console.log(`Done. Wrote ${total} upserts.`);
  console.log(`US FRED readings in DB: ${count.rows[0]?.n ?? 0}`);
}

ingestFred().catch((err) => {
  console.error(err);
  process.exit(1);
});
