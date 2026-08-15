import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { buildFeatureSnapshot } from "../src/lib/features";

config({ path: resolve(process.cwd(), ".env") });

function pct(n: number | null, digits = 2): string {
  if (n === null) return "n/a";
  return `${(n * 100).toFixed(digits)}%`;
}

function num(n: number | null, digits = 2): string {
  if (n === null) return "n/a";
  return n.toFixed(digits);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN in .env");
  }

  const db = createClient({ url, authToken });
  const symbols = (process.env.FEATURE_SYMBOLS ?? "SPY,TLT,GLD,EURUSD")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const snapshot = await buildFeatureSnapshot(db, {
    asOf: process.env.FEATURE_AS_OF,
    symbols,
  });

  console.log(`Feature snapshot as of ${snapshot.asOf}`);
  console.log("");
  console.log(
    `US regime: ${snapshot.regime.regime} — ${snapshot.regime.reasons.join("; ")}`,
  );
  console.log("  inputs:", {
    cpiYoy: pct(snapshot.regime.inputs.cpiYoy, 1),
    indproYoy: pct(snapshot.regime.inputs.indproYoy, 1),
    fedFunds: num(snapshot.regime.inputs.fedFunds),
    curve: num(snapshot.regime.inputs.curveSpread),
    vix: num(snapshot.regime.inputs.vix, 1),
  });
  console.log("");
  console.log("Macro features:");
  for (const m of snapshot.macro) {
    console.log(
      `  ${m.indicatorId.padEnd(10)} level=${num(m.level)}  change=${pct(m.changeLag)}  z=${num(m.zScore)}  (obs ${m.observedFor ?? "n/a"})`,
    );
  }
  console.log("");
  console.log("Market features:");
  for (const m of snapshot.markets) {
    console.log(
      `  ${m.symbol.padEnd(8)} close=${num(m.close)}  r1d=${pct(m.return1d)}  r5d=${pct(m.return5d)}  r21d=${pct(m.return21d)}  vol21=${pct(m.vol21d, 1)}  dd63=${pct(m.drawdown63d)}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
