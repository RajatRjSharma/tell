import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { syncCatalog } from "../src/lib/catalog";

config({ path: resolve(process.cwd(), ".env") });

async function seed() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const db = createClient({ url, authToken });
  await syncCatalog(db);

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
