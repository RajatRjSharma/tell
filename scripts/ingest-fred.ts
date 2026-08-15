import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { indicators } from "../src/data/seed";
import {
  ALFRED_PRIORITY_SERIES,
  fetchFredSeriesObservations,
} from "../src/lib/fred";
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
  const useAlfred =
    (process.env.FRED_USE_ALFRED ?? "true").toLowerCase() !== "false";
  const alfredStart = process.env.FRED_ALFRED_REALTIME_START ?? "2018-01-01";

  const fredIndicators = indicators.filter((i) => i.source === "FRED");
  const db = createClient({ url, authToken });
  const alfredSeries = new Set<string>(ALFRED_PRIORITY_SERIES);

  console.log(
    `Ingesting ${fredIndicators.length} FRED series (from ${observationStart}${useAlfred ? ", ALFRED on priority series" : ""})...`,
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

      let alfredWritten = 0;
      if (useAlfred && alfredSeries.has(seriesId)) {
        const alfredParsed = await fetchFredSeriesObservations(seriesId, {
          observationStart,
          realtimeStart: alfredStart,
          realtimeEnd: "9999-12-31",
          alfred: true,
        });
        const capped = alfredParsed.slice(-2000);
        const alfredRows = toReadingUpserts(
          "US",
          indicator.id,
          "ALFRED",
          capped,
        );
        alfredWritten = await upsertReadings(db, alfredRows);
        total += alfredWritten;
      }

      console.log(
        `${written} current` +
          (alfredWritten ? ` + ${alfredWritten} ALFRED vintages` : ""),
      );
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      throw err;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const count = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM readings WHERE source IN (?, ?) AND country_code = ?`,
    args: ["FRED", "ALFRED", "US"],
  });

  console.log(`Done. Wrote ${total} upserts.`);
  console.log(`US FRED/ALFRED readings in DB: ${count.rows[0]?.n ?? 0}`);
}

ingestFred().catch((err) => {
  console.error(err);
  process.exit(1);
});
