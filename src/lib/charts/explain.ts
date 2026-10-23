import { DIRECTION_THRESHOLD } from "@/lib/signals/score";

/** One-line, plain-language reading of a macro value. Thresholds are conventional rules of thumb. */
export function explainMacroValue(
  id: string,
  value: number,
  previous: number | null = null,
): string {
  if (id === "VIXCLS" || id === "VIX") {
    if (value < 15) return "Calm: markets expect small moves.";
    if (value < 20) return "Normal: typical day-to-day swings.";
    if (value < 30) return "Elevated: investors are paying up for protection.";
    return "Stress: markets expect large moves.";
  }

  if (id === "T10Y2Y") {
    if (value < 0) {
      return "Inverted: short rates above long rates, a classic recession warning.";
    }
    if (value < 0.5) return "Flat: little reward for lending longer.";
    return "Normal: long rates comfortably above short rates.";
  }

  if (id === "CPI") {
    if (previous == null || previous === 0) return "Price level index.";
    const mom = ((value - previous) / previous) * 100;
    const sign = mom >= 0 ? "+" : "";
    return `Prices ${sign}${mom.toFixed(2)}% vs the prior month.`;
  }

  if (id === "CPI_YOY_M") {
    if (value < 0) return "Deflation: prices falling year on year.";
    if (value < 1) return "Very low inflation.";
    if (value <= 3) return "Near most central bank targets (~2%).";
    if (value <= 6) return "Above target: pressure to keep rates high.";
    return "High inflation.";
  }

  if (id === "POLICY_RATE") {
    if (previous == null) return "Central bank policy rate.";
    const diff = value - previous;
    if (Math.abs(diff) < 0.005) return "Unchanged from the prior month.";
    return diff > 0
      ? `Hiked ${diff.toFixed(2)} pp vs the prior month.`
      : `Cut ${Math.abs(diff).toFixed(2)} pp vs the prior month.`;
  }

  return "";
}

/** Plain reading of a −1…+1 signal score. */
export function explainScore(score: number): string {
  const size = Math.abs(score);
  if (size < DIRECTION_THRESHOLD) {
    return "Inside the neutral zone: the evidence doesn't lean clearly either way.";
  }
  const side = score > 0 ? "bullish" : "bearish";
  if (size < 0.4) return `Mild ${side} lean, just past the line for a call.`;
  if (size < 0.7) return `Clear ${side} lean.`;
  return `Strong ${side} lean: most evidence points the same way.`;
}

/** Plain reading of the 0…1 evidence (confidence) value. */
export function explainConfidence(confidence: number | null): string {
  if (confidence == null) return "";
  if (confidence < 0.45) return "Thin evidence: few drivers are active.";
  if (confidence < 0.65) return "Moderate evidence.";
  return "Broad evidence: several drivers agree.";
}

export const SMALL_SAMPLE = 8;

const HORIZON_WORDS: Record<string, string> = {
  "1d": "1 day",
  "1w": "1 week",
  "1m": "1 month",
};

/** Plain reading of one event-impact cell. */
export function explainImpactCell(input: {
  symbol: string;
  horizon: string;
  source: string;
  n: number;
  median: number | null;
  hitRateUp: number | null;
}): string {
  const span = HORIZON_WORDS[input.horizon] ?? input.horizon;
  const lead = `${input.symbol}, ${span} after ${input.source} releases`;
  if (input.n === 0 || input.median == null || input.hitRateUp == null) {
    return `${lead}: no usable price data yet.`;
  }
  const up = Math.round(input.hitRateUp * 100);
  const lean =
    input.hitRateUp >= 0.6
      ? "usually rose"
      : input.hitRateUp <= 0.4
        ? "usually fell"
        : "mixed, close to a coin flip";
  const small =
    input.n < SMALL_SAMPLE ? " Small sample, so treat it as anecdotal." : "";
  return `${lead}: typical move ${formatSignedPct(input.median)}, up ${up}% of ${input.n} times (${lean}).${small}`;
}

/** 0…1 tint strength: this cell's |median| vs the largest in its column. */
export function impactIntensity(
  median: number | null,
  columnMaxAbs: number,
): number {
  if (median == null || columnMaxAbs <= 0) return 0;
  return Math.min(1, Math.abs(median) / columnMaxAbs);
}

/** Signed percent with two decimals: 0.0342 → "+3.42%". */
export function formatSignedPct(ratio: number): string {
  return `${ratio >= 0 ? "+" : "−"}${Math.abs(ratio * 100).toFixed(2)}%`;
}
