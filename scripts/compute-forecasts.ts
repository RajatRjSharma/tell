import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { computeAndStoreForecasts } from "../src/lib/forecasts";
import { getQualityReport } from "../src/lib/forecasts/store";
import { parseHorizons } from "../src/lib/signals/horizons";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const horizons = parseHorizons(process.env.SIGNAL_HORIZONS);
  const symbols = process.env.FORECAST_SYMBOLS
    ? process.env.FORECAST_SYMBOLS.split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    : null;

  const db = createClient({ url, authToken });
  console.log(
    `Evaluating signals → forecast_log (horizons=${horizons.join(",")}${symbols ? ` symbols=${symbols.join(",")}` : ""})...`,
  );

  const result = await computeAndStoreForecasts(db, {
    horizons,
    symbols,
  });

  console.log(
    `considered=${result.considered} written=${result.written} skipped=${result.skipped}`,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
