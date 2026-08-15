import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { computeAndStoreForecasts } from "../src/lib/forecasts";
import { getQualityReport } from "../src/lib/forecasts/store";
import { backfillHistoricalSignals } from "../src/lib/signals/backfill";
import { parseHorizons } from "../src/lib/signals/horizons";

config({ path: resolve(process.cwd(), ".env") });

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 2000);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const horizons = parseHorizons(process.env.SIGNAL_HORIZONS);
  const days = parsePositiveInt(process.env.BACKFILL_DAYS, 90);
  const from = process.env.BACKFILL_FROM?.trim() || null;
  const to = process.env.BACKFILL_TO?.trim() || null;
  const symbols = process.env.FORECAST_SYMBOLS
    ? process.env.FORECAST_SYMBOLS.split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    : undefined;
  const skipForecasts = process.env.BACKFILL_SKIP_FORECASTS === "1";

  const db = createClient({ url, authToken });

  console.log(
    `Backfilling signals (days=${from || to ? "range" : days} horizons=${horizons.join(",")}${symbols ? ` symbols=${symbols.join(",")}` : ""})...`,
  );

  const result = await backfillHistoricalSignals(db, {
    days,
    from,
    to,
    symbols,
    horizons,
  });

  console.log(
    `dates=${result.dates.length} first=${result.dates[0]} last=${result.dates[result.dates.length - 1]}`,
  );
  console.log(`wrote=${result.written} (~${result.signalsPerDay}/day)`);

  if (!skipForecasts) {
    console.log("Evaluating resolved signals → forecast_log...");
    const forecast = await computeAndStoreForecasts(db, {
      horizons,
      symbols: symbols ?? null,
    });
    console.log(
      `forecasts considered=${forecast.considered} written=${forecast.written} skipped=${forecast.skipped}`,
    );

    const report = await getQualityReport(db);
    console.log(
      `hit_rate=${report.overall.hitRate == null ? "n/a" : (report.overall.hitRate * 100).toFixed(1) + "%"} n=${report.overall.n}`,
    );
    for (const [horizon, stats] of Object.entries(report.byHorizon)) {
      console.log(
        `  ${horizon}: hit_rate=${stats.hitRate == null ? "n/a" : (stats.hitRate * 100).toFixed(1) + "%"} n=${stats.n}`,
      );
    }
  }

  const counts = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM signals) AS signals,
      (SELECT COUNT(DISTINCT as_of_date) FROM signals) AS signal_days,
      (SELECT COUNT(*) FROM forecast_log WHERE correct IS NOT NULL) AS forecasts
  `);
  const row = counts.rows[0];
  console.log(
    `db signals=${row?.signals ?? 0} distinct_as_of=${row?.signal_days ?? 0} resolved_forecasts=${row?.forecasts ?? 0}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
