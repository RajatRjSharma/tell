import type { Client } from "@libsql/client";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export type NearTermBias = {
  asOf: string | null;
  today: {
    label: "risk-on" | "mixed" | "risk-off";
    score: number;
    bullish: number;
    neutral: number;
    bearish: number;
    note: string;
  };
  tomorrow: {
    label: "risk-on" | "mixed" | "risk-off";
    score: number;
    note: string;
  };
  sampleSize: number;
};

function labelFromScore(score: number): "risk-on" | "mixed" | "risk-off" {
  if (score >= 0.15) return "risk-on";
  if (score <= -0.15) return "risk-off";
  return "mixed";
}

function noteFor(
  label: "risk-on" | "mixed" | "risk-off",
  horizon: "today" | "tomorrow",
): string {
  if (horizon === "today") {
    if (label === "risk-on")
      return "1d ensemble leans constructive across the universe.";
    if (label === "risk-off")
      return "1d ensemble leans defensive across the universe.";
    return "1d ensemble is split — no clean directional bias.";
  }
  if (label === "risk-on")
    return "Carry-forward from 1d with a mild positive tilt.";
  if (label === "risk-off")
    return "Carry-forward from 1d with a mild defensive tilt.";
  return "Near-term path is ambiguous; wait for the next session confirmation.";
}

/** 1d ensemble bias; tomorrow = dampened today. */
export async function getNearTermRiskBias(
  db: Client,
  options?: { modelVersion?: string; symbols?: string[] | null },
): Promise<NearTermBias> {
  const modelVersion = options?.modelVersion ?? SIGNAL_MODEL_VERSION;
  const symbols = options?.symbols?.filter(Boolean) ?? null;

  const args: Array<string | number> = [modelVersion];
  let symbolFilter = "";
  if (symbols && symbols.length > 0) {
    symbolFilter = `AND symbol IN (${symbols.map(() => "?").join(",")})`;
    args.push(...symbols);
  }

  const latest = await db.execute({
    sql: `SELECT MAX(as_of_date) AS as_of
          FROM signals
          WHERE horizon = '1d' AND model_version = ? ${symbolFilter}`,
    args,
  });
  const asOf =
    latest.rows[0]?.as_of == null ? null : String(latest.rows[0].as_of);

  if (!asOf) {
    return {
      asOf: null,
      today: {
        label: "mixed",
        score: 0,
        bullish: 0,
        neutral: 0,
        bearish: 0,
        note: "No 1d signals available yet.",
      },
      tomorrow: {
        label: "mixed",
        score: 0,
        note: "Need a daily signal run before projecting tomorrow.",
      },
      sampleSize: 0,
    };
  }

  const rows = await db.execute({
    sql: `SELECT direction, score, confidence
          FROM signals
          WHERE horizon = '1d'
            AND model_version = ?
            AND as_of_date = ?
            ${symbolFilter}`,
    args: [modelVersion, asOf, ...(symbols ?? [])],
  });

  let bullish = 0;
  let neutral = 0;
  let bearish = 0;
  let scoreSum = 0;

  for (const row of rows.rows) {
    const direction = String(row.direction);
    if (direction === "bullish") bullish += 1;
    else if (direction === "bearish") bearish += 1;
    else neutral += 1;
    scoreSum += Number(row.score ?? 0);
  }

  const n = rows.rows.length;
  const todayScore = n === 0 ? 0 : scoreSum / n;
  const todayLabel = labelFromScore(todayScore);
  const tomorrowScore = todayScore * 0.65;
  const tomorrowLabel = labelFromScore(tomorrowScore);

  return {
    asOf,
    today: {
      label: todayLabel,
      score: Number(todayScore.toFixed(3)),
      bullish,
      neutral,
      bearish,
      note: noteFor(todayLabel, "today"),
    },
    tomorrow: {
      label: tomorrowLabel,
      score: Number(tomorrowScore.toFixed(3)),
      note: noteFor(tomorrowLabel, "tomorrow"),
    },
    sampleSize: n,
  };
}
