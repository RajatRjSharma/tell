import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { ingestPolicyEvents } from "../src/lib/events/ingest";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const db = createClient({ url, authToken });
  console.log("Ingesting Fed / ECB / BoE RSS → events...");

  const result = await ingestPolicyEvents(db);
  console.log(
    `feeds=${result.feeds} items=${result.items} written=${result.written} skipped=${result.skipped}`,
  );
  for (const error of result.errors) {
    console.warn(`  warn: ${error}`);
  }

  const count = await db.execute("SELECT COUNT(*) AS n FROM events");
  console.log(`events in DB: ${count.rows[0]?.n ?? 0}`);

  if (result.errors.length === result.feeds) {
    throw new Error("All policy feeds failed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
