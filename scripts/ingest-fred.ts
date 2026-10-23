import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { indicators } from "../src/data/seed";
import {
  ALFRED_PRIORITY_SERIES,
  fetchFredSeriesObservations,
} from "../src/lib/fred";
import {
  fullRefreshRequested,
  incrementalStart,
} from "../src/lib/ingest/incremental";
import { assertFailureBudget, runIsolated } from "../src/lib/ingest/run";
import {
  fetchRecentTreasuryCurve,
  treasuryToReadings,
} from "../src/lib/treasury";
import {
  latestReadingDate,
  toReadingUpserts,
  upsertReadings,
} from "../src/lib/readings";

config({ path: resolve(process.cwd(), ".env") });

const DEFAULT_START = "2015-01-01";
/** Re-read recent months so FRED revisions overwrite earlier prints. */
const REVISION_OVERLAP_DAYS = 400;

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
  const fullRefresh = fullRefreshRequested();

  const fredIndicators = indicators.filter((i) => i.source === "FRED");
  const db = createClient({ url, authToken });
  const alfredSeries = new Set<string>(ALFRED_PRIORITY_SERIES);

  console.log(
    `Ingesting ${fredIndicators.length} FRED series (${fullRefresh ? `full from ${observationStart}` : "incremental"}${useAlfred ? ", ALFRED on priority series" : ""})...`,
  );

  const run = await runIsolated(
    fredIndicators,
    (indicator) => `${indicator.id} (${indicator.source_series_id})`,
    async (indicator) => {
      const seriesId = indicator.source_series_id;
      const start = fullRefresh
        ? observationStart
        : incrementalStart(
            await latestReadingDate(db, "US", indicator.id),
            observationStart,
            REVISION_OVERLAP_DAYS,
          );

      const parsed = await fetchFredSeriesObservations(seriesId, {
        observationStart: start,
      });
      let written = await upsertReadings(
        db,
        toReadingUpserts("US", indicator.id, "FRED", parsed),
      );

      if (useAlfred && alfredSeries.has(seriesId)) {
        const alfredParsed = await fetchFredSeriesObservations(seriesId, {
          observationStart,
          realtimeStart: alfredStart,
          realtimeEnd: "9999-12-31",
          alfred: true,
        });
        written += await upsertReadings(
          db,
          toReadingUpserts(
            "US",
            indicator.id,
            "ALFRED",
            alfredParsed.slice(-2000),
          ),
        );
      }

      return written;
    },
    { pauseMs: 200 },
  );

  // Treasury publishes the par curve the same afternoon; FRED lags a day or
  // two. Only add dates FRED doesn't have yet — FRED overwrites them later.
  try {
    const treasury = treasuryToReadings(await fetchRecentTreasuryCurve());
    for (const [indicatorId, readings] of Object.entries(treasury)) {
      const latest = await latestReadingDate(db, "US", indicatorId);
      const fresh = readings.filter(
        (row) => !latest || row.observedFor > latest,
      );
      const written = await upsertReadings(
        db,
        toReadingUpserts("US", indicatorId, "Treasury", fresh),
      );
      console.log(`  ${indicatorId} (Treasury same-day): ${written}`);
    }
  } catch (err) {
    console.warn(
      `  Treasury same-day fill skipped: ${err instanceof Error ? err.message : err}`,
    );
  }

  const count = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM readings WHERE source IN (?, ?) AND country_code = ?`,
    args: ["FRED", "ALFRED", "US"],
  });

  console.log(
    `Done. Wrote ${run.written} upserts; ${run.failed.length} series failed.`,
  );
  console.log(`US FRED/ALFRED readings in DB: ${count.rows[0]?.n ?? 0}`);
  assertFailureBudget("ingest:fred", run);
}

ingestFred().catch((err) => {
  console.error(err);
  process.exit(1);
});
