import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { companies } from "../src/data/companies";
import { assertFailureBudget, runIsolated } from "../src/lib/ingest/run";
import {
  buildCompanySnapshot,
  companySnapshotAgeHours,
  fetchFinnhubProfile,
  upsertCompanySnapshot,
} from "../src/lib/market-map/company-snapshots";
import { isUsMarketOpen } from "../src/lib/market-hours";
import { fetchYahooDailyBars } from "../src/lib/yahoo";

config({ path: resolve(process.cwd(), ".env") });

/** Finnhub free tier allows 60 calls a minute; one profile call per company. */
const PAUSE_MS = 1_100;
const LOOKBACK_DAYS = 45;

async function ingestCompanies() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.log("FINNHUB_API_KEY not set; skipping company snapshots.");
    return;
  }

  const db = createClient({ url, authToken });
  const maxAgeHours = Number(process.env.COMPANIES_MAX_AGE_HOURS ?? 20);
  const age = await companySnapshotAgeHours(db);
  if (process.env.COMPANIES_FORCE !== "1" && age != null && age < maxAgeHours) {
    console.log(
      `Company snapshots are ${age.toFixed(1)}h old (< ${maxAgeHours}h); skipping.`,
    );
    return;
  }

  const now = new Date();
  const toUnix = Math.floor(now.getTime() / 1000);
  const fromUnix = toUnix - LOOKBACK_DAYS * 86_400;
  const rates = new Map<string, Promise<number>>();
  const unitsPerUsd = (code: string) => {
    if (!rates.has(code)) {
      rates.set(
        code,
        fetchYahooDailyBars(`${code}=X`, fromUnix, toUnix).then(
          (bars) => bars.at(-1)?.close ?? Number.NaN,
        ),
      );
    }
    return rates.get(code)!;
  };
  const openSessionDate = isUsMarketOpen(now)
    ? now.toISOString().slice(0, 10)
    : null;

  console.log(`Snapshotting ${companies.length} companies...`);
  const run = await runIsolated(
    companies,
    (company) => company.symbol,
    async (company) => {
      const snapshot = await buildCompanySnapshot(company, {
        profile: (symbol) => fetchFinnhubProfile(symbol, { apiKey }),
        bars: (symbol) => fetchYahooDailyBars(symbol, fromUnix, toUnix),
        unitsPerUsd,
        openSessionDate,
      });
      await upsertCompanySnapshot(db, snapshot);
      return 1;
    },
    { pauseMs: PAUSE_MS },
  );

  console.log(
    `Done. ${run.written} snapshots; ${run.failed.length} companies failed.`,
  );
  assertFailureBudget("ingest:companies", run, 0.2);
}

ingestCompanies().catch((err) => {
  console.error(err);
  process.exit(1);
});
