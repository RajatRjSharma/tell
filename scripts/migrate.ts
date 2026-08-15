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
    .map((s) =>
      s
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((s) => s.length > 0);

  const db = createClient({ url, authToken });

  console.log(`Applying ${statements.length} statements to Turso...`);

  for (const statement of statements) {
    await db.execute(statement);
  }

  await softUpgradeForecastLog(db);
  await softUpgradeUsers(db);

  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

  console.log("Tables:");
  for (const row of tables.rows) {
    console.log(`  - ${row.name}`);
  }

  console.log("Migration complete.");
}

async function softUpgradeForecastLog(db: ReturnType<typeof createClient>) {
  const info = await db.execute("PRAGMA table_info(forecast_log)");
  const columns = new Set(info.rows.map((row) => String(row.name)));

  if (!columns.has("model_version")) {
    console.log("Upgrading forecast_log: add model_version");
    await db.execute(
      "ALTER TABLE forecast_log ADD COLUMN model_version TEXT DEFAULT 'rules-v1'",
    );
    await db.execute(
      "UPDATE forecast_log SET model_version = 'rules-v1' WHERE model_version IS NULL",
    );
  }

  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_forecast_log_uq
     ON forecast_log (symbol, horizon, as_of_date, model_version)`,
  );
}

async function softUpgradeUsers(db: ReturnType<typeof createClient>) {
  const info = await db.execute("PRAGMA table_info(users)");
  const columns = new Set(info.rows.map((row) => String(row.name)));

  if (!columns.has("username")) {
    console.log("Upgrading users: add username");
    await db.execute("ALTER TABLE users ADD COLUMN username TEXT");
  }

  const missing = await db.execute(
    `SELECT id, email FROM users
     WHERE username IS NULL OR trim(username) = ''`,
  );
  for (const row of missing.rows) {
    const id = String(row.id);
    const email = String(row.email);
    const local = email.split("@")[0] ?? "user";
    const cleaned = local
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    const base = cleaned.length >= 3 ? cleaned : `user_${id.slice(0, 6)}`;
    let candidate = base;
    let n = 0;
    while (true) {
      const clash = await db.execute({
        sql: "SELECT id FROM users WHERE username = ? AND id != ?",
        args: [candidate, id],
      });
      if (clash.rows.length === 0) break;
      n += 1;
      candidate = `${base}_${n}`.slice(0, 32);
    }
    await db.execute({
      sql: "UPDATE users SET username = ? WHERE id = ?",
      args: [candidate, id],
    });
  }

  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`,
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
