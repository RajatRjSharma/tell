import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { countries } from "../src/data/seed";
import type { ParsedReading } from "../src/lib/fred";
import { fetchBisPolicyRates } from "../src/lib/bis";
import {
  fetchImfSdmxReadings,
  IMF_CPI_YOY_MONTHLY_KEY,
} from "../src/lib/imf-sdmx";
import { assertFailureBudget, runIsolated } from "../src/lib/ingest/run";
import { toReadingUpserts, upsertReadings } from "../src/lib/readings";

config({ path: resolve(process.cwd(), ".env") });

type GlobalSource = {
  indicatorId: "CPI_YOY_M" | "POLICY_RATE";
  source: string;
  fetch: (
    countryCodes: string[],
    startPeriod: string,
  ) => Promise<Record<string, ParsedReading[]>>;
};

const SOURCES: GlobalSource[] = [
  {
    indicatorId: "CPI_YOY_M",
    source: "IMF",
    fetch: (codes, startPeriod) =>
      fetchImfSdmxReadings("CPI", IMF_CPI_YOY_MONTHLY_KEY, codes, {
        startPeriod,
      }),
  },
  {
    indicatorId: "POLICY_RATE",
    source: "BIS",
    fetch: (codes, startPeriod) => fetchBisPolicyRates(codes, { startPeriod }),
  },
];

async function ingestGlobalMacro() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const startPeriod = process.env.GLOBAL_MACRO_START ?? "2018-01";
  const countryCodes = countries.map((country) => country.code);
  const db = createClient({ url, authToken });

  console.log(
    `Ingesting monthly inflation (IMF) and policy rates (BIS) for ${countryCodes.join(", ")} from ${startPeriod}...`,
  );

  const run = await runIsolated(
    SOURCES,
    (source) => `${source.indicatorId} (${source.source})`,
    async (source) => {
      const byCountry = await source.fetch(countryCodes, startPeriod);
      const covered = Object.keys(byCountry).filter(
        (code) => (byCountry[code]?.length ?? 0) > 0,
      );
      if (covered.length === 0) {
        throw new Error("no observations returned");
      }

      let written = 0;
      for (const code of covered) {
        written += await upsertReadings(
          db,
          toReadingUpserts(
            code,
            source.indicatorId,
            source.source,
            byCountry[code]!,
          ),
        );
      }
      return written;
    },
    { pauseMs: 500 },
  );

  console.log(
    `Done. Wrote ${run.written} upserts; ${run.failed.length} sources failed.`,
  );
  assertFailureBudget("ingest:global-macro", run);
}

ingestGlobalMacro().catch((err) => {
  console.error(err);
  process.exit(1);
});
