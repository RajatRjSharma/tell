/**
 * Optional live AI eval.
 * Usage: TELL_AI_EVAL=1 npm run test:eval
 *
 * Requires Turso + GEMINI_API_KEY + GROQ_API_KEY.
 * Skips cleanly when TELL_AI_EVAL is unset.
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { generateBrief } from "../src/lib/ai/brief";
import { answerResearchQuestion } from "../src/lib/ai/chat";
import { buildResearchContext } from "../src/lib/ai/context";
import {
  evaluateBriefOutput,
  evaluateChatOutput,
} from "../src/lib/ai/eval/rubric";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  if (process.env.TELL_AI_EVAL !== "1") {
    console.log("Skipping live AI eval (set TELL_AI_EVAL=1 to run).");
    return;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }
  if (!process.env.GEMINI_API_KEY || !process.env.GROQ_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY or GROQ_API_KEY in .env");
  }

  const db = createClient({ url, authToken });
  const context = await buildResearchContext(db, {
    symbol: "SPY",
    horizon: "1d",
  });

  const brief = await generateBrief(db, {
    symbol: "SPY",
    horizon: "1d",
    refresh: true,
  });
  const briefReport = evaluateBriefOutput("live-brief-spy", brief, context);

  const chat = await answerResearchQuestion(db, {
    message: "Why is SPY neutral or directional on 1d using current evidence?",
    symbol: "SPY",
    horizon: "1d",
  });
  const chatReport = evaluateChatOutput("live-chat-spy", chat, context, {
    mustMention: ["SPY"],
  });

  const reports = [briefReport, chatReport];
  for (const report of reports) {
    console.log(
      `${report.pass ? "PASS" : "FAIL"} ${report.name} score=${report.score.toFixed(2)}`,
    );
    for (const check of report.checks.filter((item) => !item.pass)) {
      console.log(`  - ${check.id}${check.detail ? ` (${check.detail})` : ""}`);
    }
  }

  if (reports.some((report) => !report.pass)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
