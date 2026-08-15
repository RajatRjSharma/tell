import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { assets, countries, indicators } from "../src/data/seed";

config({ path: resolve(process.cwd(), ".env") });

async function seed() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const db = createClient({ url, authToken });

  for (const c of countries) {
    await db.execute({
      sql: `INSERT INTO countries (code, name, region, currency)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
              name = excluded.name,
              region = excluded.region,
              currency = excluded.currency`,
      args: [c.code, c.name, c.region, c.currency],
    });
  }

  for (const i of indicators) {
    await db.execute({
      sql: `INSERT INTO indicators (id, name, unit, frequency, source, source_series_id, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              unit = excluded.unit,
              frequency = excluded.frequency,
              source = excluded.source,
              source_series_id = excluded.source_series_id,
              description = excluded.description`,
      args: [
        i.id,
        i.name,
        i.unit,
        i.frequency,
        i.source,
        i.source_series_id,
        i.description,
      ],
    });
  }

  for (const a of assets) {
    await db.execute({
      sql: `INSERT INTO assets (symbol, name, asset_class, country_code, currency, source_symbol)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
              name = excluded.name,
              asset_class = excluded.asset_class,
              country_code = excluded.country_code,
              currency = excluded.currency,
              source_symbol = excluded.source_symbol`,
      args: [
        a.symbol,
        a.name,
        a.asset_class,
        a.country_code,
        a.currency,
        a.source_symbol,
      ],
    });
  }

  const counts = await db.execute(`
    SELECT 'countries' AS t, COUNT(*) AS n FROM countries
    UNION ALL SELECT 'indicators', COUNT(*) FROM indicators
    UNION ALL SELECT 'assets', COUNT(*) FROM assets
  `);

  console.log("Seed complete:");
  for (const row of counts.rows) {
    console.log(`  ${row.t}: ${row.n}`);
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
