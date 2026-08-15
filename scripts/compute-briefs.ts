import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { assets } from "../src/data/seed";
import { generateBrief } from "../src/lib/ai/brief";
import { cacheClear } from "../src/lib/ai/cache";
import { parseHorizons } from "../src/lib/signals/horizons";

config({ path: resolve(process.cwd(), ".env") });

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function assertAiAllowedOutsideCi(task: string) {
  if (process.env.CI === "true" && process.env.TELL_ALLOW_AI_IN_CI !== "1") {
    throw new Error(
      `Refusing to run ${task} in CI (protects free Gemini/Groq credits). Run locally instead.`,
    );
  }
}

async function main() {
  assertAiAllowedOutsideCi("compute-briefs");

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }
  if (!process.env.GEMINI_API_KEY) {
    console.log("Skipping briefs: GEMINI_API_KEY not set");
    return;
  }

  const horizons = parseHorizons(process.env.BRIEF_HORIZONS ?? "1d,1w,1m");
  const symbols = (
    process.env.BRIEF_SYMBOLS ?? assets.map((asset) => asset.symbol).join(",")
  )
    .split(",")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  const delayMs = Number(process.env.BRIEF_DELAY_MS ?? "400");
  const db = createClient({ url, authToken });
  cacheClear();

  console.log(
    `Computing Gemini briefs for ${symbols.length} assets × ${horizons.join(",")}...`,
  );

  let written = 0;
  let failed = 0;

  for (const symbol of symbols) {
    for (const horizon of horizons) {
      try {
        const brief = await generateBrief(db, {
          symbol,
          horizon,
          refresh: true,
          persist: true,
        });
        written += 1;
        console.log(
          `${symbol} ${horizon}: ${brief.title.slice(0, 72)}${brief.delta ? " (delta)" : ""}`,
        );
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : "unknown brief error";
        console.error(`${symbol} ${horizon}: FAIL ${message.slice(0, 160)}`);
      }

      if (delayMs > 0) await sleep(delayMs);
    }
  }

  console.log(`done written=${written} failed=${failed}`);
  if (failed > 0 && written === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
