import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { evaluateAlertRules } from "../src/lib/alerts/evaluate";

config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const db = createClient({ url, authToken });
  console.log("Evaluating alert rules against latest signals...");

  const result = await evaluateAlertRules(db);
  console.log(
    `considered=${result.considered} triggered=${result.triggered} baselined=${result.baselined} skipped=${result.skipped} emailed=${result.emailed}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
