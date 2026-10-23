import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { indicators } from "../src/data/seed";
import { fetchCrossCountryReadings } from "../src/lib/cross-country";
import { IMF_COUNTRY_CODES } from "../src/lib/imf";
import { assertFailureBudget, runIsolated } from "../src/lib/ingest/run";
import { toReadingUpserts, upsertReadings } from "../src/lib/readings";

config({ path: resolve(process.cwd(), ".env") });

async function ingestImf() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const minYear = Number(process.env.IMF_MIN_YEAR ?? 2015);
  const imfIndicators = indicators.filter((i) => i.source === "IMF");
  const db = createClient({ url, authToken });

  console.log(
    `Ingesting ${imfIndicators.length} cross-country indicators for ${IMF_COUNTRY_CODES.join(", ")} (from ${minYear})...`,
  );
  const provider = process.env.CROSS_COUNTRY_PROVIDER ?? "auto";
  console.log(
    provider.toLowerCase() === "imf"
      ? "  (IMF DataMapper only — local manual mode)"
      : "  (IMF preferred; World Bank fallback if blocked)",
  );

  const sourcesUsed = new Set<string>();

  const run = await runIsolated(
    imfIndicators,
    (indicator) => `${indicator.id} (${indicator.source_series_id})`,
    async (indicator) => {
      const { source, byCountry } = await fetchCrossCountryReadings(
        indicator.source_series_id,
        [...IMF_COUNTRY_CODES],
        { minYear },
      );
      sourcesUsed.add(source);

      let seriesTotal = 0;
      for (const countryCode of IMF_COUNTRY_CODES) {
        const parsed = byCountry[countryCode] ?? [];
        seriesTotal += await upsertReadings(
          db,
          toReadingUpserts(countryCode, indicator.id, source, parsed),
        );
      }
      return seriesTotal;
    },
    { pauseMs: 300 },
  );
  const total = run.written;

  const count = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM readings
          WHERE indicator_id IN (${imfIndicators.map(() => "?").join(",")})`,
    args: imfIndicators.map((i) => i.id),
  });

  console.log(`Done. Wrote ${total} upserts.`);
  console.log(`Providers used: ${[...sourcesUsed].join(", ") || "none"}`);
  console.log(`Cross-country readings in DB: ${count.rows[0]?.n ?? 0}`);
  assertFailureBudget("ingest:imf", run);
}

ingestImf().catch((err) => {
  console.error(err);
  process.exit(1);
});
