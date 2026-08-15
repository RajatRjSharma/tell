import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { indicators } from "../src/data/seed";
import { fetchImfCountryReadings, IMF_COUNTRY_CODES } from "../src/lib/imf";
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
    `Ingesting ${imfIndicators.length} IMF indicators for ${IMF_COUNTRY_CODES.join(", ")} (from ${minYear})...`,
  );

  let total = 0;

  for (const indicator of imfIndicators) {
    const code = indicator.source_series_id;
    process.stdout.write(`  ${indicator.id} (${code})... `);

    try {
      const byCountry = await fetchImfCountryReadings(
        code,
        [...IMF_COUNTRY_CODES],
        { minYear },
      );

      let seriesTotal = 0;
      for (const countryCode of IMF_COUNTRY_CODES) {
        const parsed = byCountry[countryCode] ?? [];
        const rows = toReadingUpserts(countryCode, indicator.id, "IMF", parsed);
        seriesTotal += await upsertReadings(db, rows);
      }

      total += seriesTotal;
      console.log(`${seriesTotal} rows`);
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      throw err;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  const count = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM readings WHERE source = ?`,
    args: ["IMF"],
  });

  console.log(`Done. Wrote ${total} upserts.`);
  console.log(`IMF readings in DB: ${count.rows[0]?.n ?? 0}`);
}

ingestImf().catch((err) => {
  console.error(err);
  process.exit(1);
});
