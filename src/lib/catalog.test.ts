import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { retireSymbols, syncCatalog } from "@/lib/catalog";

async function freshDb() {
  const db = createClient({ url: ":memory:" });
  const schema = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
  for (const statement of schema.split(";")) {
    const sql = statement
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (sql) await db.execute(sql);
  }
  return db;
}

describe("retireSymbols", () => {
  it("moves user rows to the replacement and drops derived data", async () => {
    const db = await freshDb();
    await syncCatalog(db);
    await db.batch([
      `INSERT INTO assets (symbol, name, asset_class, country_code, currency, source_symbol)
       VALUES ('OLD', 'Old', 'fx', 'CN', 'CNH', 'OLD=X')`,
      `INSERT INTO asset_readings (symbol, date, close) VALUES ('OLD', '2026-10-01', 7.1)`,
      `INSERT INTO watchlist_items (user_id, symbol) VALUES ('u1', 'OLD'), ('u2', 'OLD'), ('u2', 'USDCNY')`,
      `INSERT INTO alert_rules (user_id, symbol, horizon, rule_type) VALUES ('u1', 'OLD', '1d', 'direction_change')`,
    ]);

    expect(await retireSymbols(db, { OLD: "USDCNY" })).toEqual(["OLD→USDCNY"]);

    const watch = await db.execute(
      "SELECT user_id, symbol FROM watchlist_items ORDER BY user_id",
    );
    expect(watch.rows.map((row) => [row.user_id, row.symbol])).toEqual([
      ["u1", "USDCNY"],
      ["u2", "USDCNY"],
    ]);
    const alerts = await db.execute("SELECT symbol FROM alert_rules");
    expect(alerts.rows[0]?.symbol).toBe("USDCNY");
    const bars = await db.execute(
      "SELECT COUNT(*) AS n FROM asset_readings WHERE symbol = 'OLD'",
    );
    expect(Number(bars.rows[0]?.n)).toBe(0);
    const asset = await db.execute(
      "SELECT COUNT(*) AS n FROM assets WHERE symbol = 'OLD'",
    );
    expect(Number(asset.rows[0]?.n)).toBe(0);

    expect(await retireSymbols(db, { OLD: "USDCNY" })).toEqual([]);
  });
});
