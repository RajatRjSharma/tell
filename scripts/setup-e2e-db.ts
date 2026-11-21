import { createClient } from "@libsql/client";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assets } from "../src/data/seed";
import { isScoredClass } from "../src/lib/assets/classes";
import { syncCatalog } from "../src/lib/catalog";
import { SIGNAL_MODEL_VERSION } from "../src/lib/signals/score";

const databasePath = resolve(
  process.cwd(),
  process.env.E2E_DATABASE_PATH ?? ".tmp/playwright.db",
);
const databaseUrl = `file:${databasePath}`;

function schemaStatements(): string[] {
  return readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8")
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

async function setup() {
  mkdirSync(dirname(databasePath), { recursive: true });
  for (const suffix of ["", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }

  const db = createClient({ url: databaseUrl });

  for (const statement of schemaStatements()) {
    await db.execute(statement);
  }

  await syncCatalog(db);

  const dates = [
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
    "2026-08-01",
  ];
  const macroSeries: Record<string, number[]> = {
    CPI: [328, 329, 330, 331, 332, 333],
    T10Y2Y: [0.1, 0.2, 0.25, 0.3, 0.4, 0.5],
    VIXCLS: [18, 17, 16, 15.5, 15, 14.5],
  };

  for (const [indicatorId, values] of Object.entries(macroSeries)) {
    for (const [index, value] of values.entries()) {
      await db.execute({
        sql: `INSERT INTO readings
                (country_code, indicator_id, observed_for, value, vintage, source)
              VALUES ('US', ?, ?, ?, 'current', 'fixture')`,
        args: [indicatorId, dates[index]!, value],
      });
    }
  }

  // Local macro is read with a rolling window, so anchor fixtures to today.
  const lastMonth = new Date();
  lastMonth.setUTCDate(1);
  lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
  const localMacroMonth = lastMonth.toISOString().slice(0, 10);
  const localMacro: Array<[string, string, number]> = [
    ["IN", "CPI_YOY_M", 4.4],
    ["IN", "POLICY_RATE", 5.5],
    ["DE", "CPI_YOY_M", 2.1],
    ["DE", "POLICY_RATE", 2],
  ];
  for (const [countryCode, indicatorId, value] of localMacro) {
    await db.execute({
      sql: `INSERT INTO readings
              (country_code, indicator_id, observed_for, value, vintage, source)
            VALUES (?, ?, ?, ?, 'current', 'fixture')`,
      args: [countryCode, indicatorId, localMacroMonth, value],
    });
  }

  const asOf = "2026-08-14";
  const horizons = ["1d", "1w", "1m"];
  const scoredAssets = assets.filter((asset) =>
    isScoredClass(asset.asset_class),
  );
  for (const [assetIndex, asset] of scoredAssets.entries()) {
    for (const [horizonIndex, horizon] of horizons.entries()) {
      const score = ((assetIndex % 3) - 1) * 0.2;
      const direction =
        score > 0.1 ? "bullish" : score < -0.1 ? "bearish" : "neutral";
      await db.execute({
        sql: `INSERT INTO signals
                (symbol, horizon, as_of_date, score, direction, confidence,
                 drivers_json, regime, model_version)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'neutral', ?)`,
        args: [
          asset.symbol,
          horizon,
          asOf,
          score,
          direction,
          0.6 + horizonIndex * 0.05,
          JSON.stringify([
            {
              code: "e2e_fixture",
              detail: "Deterministic test fixture",
              contribution: score,
            },
          ]),
          SIGNAL_MODEL_VERSION,
        ],
      });

      await db.execute({
        sql: `INSERT INTO research_briefs
                (symbol, horizon, as_of_date, title, summary, bullets_json,
                 risks_json, model, provider)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'fixture-model', 'fixture')`,
        args: [
          asset.symbol,
          horizon,
          asOf,
          `${asset.symbol} test brief`,
          "Deterministic e2e brief. No external AI provider was called.",
          JSON.stringify(["Fixture signal", "Fixture macro context"]),
          JSON.stringify(["Fixture data only"]),
        ],
      });
    }
  }

  for (let index = 0; index < 30; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    const close = 500 + index;
    await db.execute({
      sql: `INSERT INTO asset_readings
              (symbol, date, open, high, low, close, volume)
            VALUES ('SPY', ?, ?, ?, ?, ?, ?)`,
      args: [
        `2026-07-${day}`,
        close - 1,
        close + 2,
        close - 2,
        close,
        1_000_000 + index,
      ],
    });
  }

  for (let index = 0; index < 30; index += 1) {
    const day = String(index + 1).padStart(2, "0");
    const close = 3300 - index * 5;
    await db.execute({
      sql: `INSERT INTO asset_readings (symbol, date, close)
            VALUES ('GOLD', ?, ?)`,
      args: [`2026-07-${day}`, close],
    });
  }

  // symbol, market cap (USD), close, 1d, 1w, 1m change
  const companySnapshots: Array<
    [string, number, number, number, number, number]
  > = [
    ["AAPL", 3.4e12, 230, 0.012, 0.03, 0.05],
    ["MSFT", 3.1e12, 440, -0.018, -0.01, 0.02],
    ["TSM", 1.2e12, 210, 0.025, 0.04, -0.03],
  ];
  for (const row of companySnapshots) {
    await db.execute({
      sql: `INSERT INTO company_snapshots
              (symbol, market_cap_usd, close, change_1d, change_1w, change_1m, as_of_date)
            VALUES (?, ?, ?, ?, ?, ?, '2026-07-30')`,
      args: row,
    });
  }

  await db.execute({
    sql: `INSERT INTO events
            (id, date, country_code, type, title, summary, sentiment,
             assets_impact_json, source)
          VALUES ('e2e-fed-event', ?, 'US', 'central_bank', ?, ?, 0, ?, 'fixture')`,
    args: [
      asOf,
      "Federal Reserve fixture update",
      "Deterministic policy event for browser tests.",
      JSON.stringify(["SPY", "TLT"]),
    ],
  });

  await db.execute({
    sql: `INSERT INTO forecast_log
            (symbol, horizon, as_of_date, direction, score, confidence,
             actual_return, correct, model_version, evaluated_at)
          VALUES ('SPY', '1d', '2026-08-13', 'neutral', 0, 0.6,
                  0.001, 1, ?, '2026-08-14')`,
    args: [SIGNAL_MODEL_VERSION],
  });

  db.close();
  console.log(`Created isolated e2e database: ${databasePath}`);
}

setup().catch((error) => {
  console.error(error);
  process.exit(1);
});
