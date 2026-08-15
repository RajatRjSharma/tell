import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: resolve(process.cwd(), ".env") });

async function migrate() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const schemaPath = resolve(process.cwd(), "db/schema.sql");
  const sql = readFileSync(schemaPath, "utf8");

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  const db = createClient({ url, authToken });

  console.log(`Applying ${statements.length} statements to Turso...`);

  for (const statement of statements) {
    await db.execute(statement);
  }

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  console.log("Tables:");
  for (const row of tables.rows) {
    console.log(`  - ${row.name}`);
  }

  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
