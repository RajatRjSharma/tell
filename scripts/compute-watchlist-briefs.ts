import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { cacheClear } from "../src/lib/ai/cache";
import { computeWatchlistBriefs } from "../src/lib/ai/watchlist-brief";

config({ path: resolve(process.cwd(), ".env") });

function assertAiAllowedOutsideCi(task: string) {
  if (process.env.CI === "true" && process.env.TELL_ALLOW_AI_IN_CI !== "1") {
    throw new Error(
      `Refusing to run ${task} in CI. Set TELL_ALLOW_AI_IN_CI=1 to override.`,
    );
  }
}

async function main() {
  assertAiAllowedOutsideCi("compute-watchlist-briefs");

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }
  if (!process.env.GEMINI_API_KEY) {
    console.log("Skipping watchlist briefs: GEMINI_API_KEY not set");
    return;
  }

  const db = createClient({ url, authToken });
  cacheClear();

  // Brief generation is safe by default; bulk delivery requires an explicit
  // operator opt-in until per-user notification preferences are available.
  const sendEmail = process.env.WATCHLIST_BRIEF_EMAIL === "1";
  console.log("Computing watchlist-scoped Gemini briefs...");
  const result = await computeWatchlistBriefs(db, {
    horizon: process.env.BRIEF_HORIZONS?.split(",")[0]?.trim() || "1d",
    sendEmail,
  });
  console.log(
    `done users=${result.users} emailed=${result.emailed} skipped=${result.skipped}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
