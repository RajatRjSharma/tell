import { describeHorizon } from "@/lib/decision/horizons";
import type { OutlookSignalDto } from "@/lib/api/outlook";

export type DecisionLean = "up" | "down" | "mixed" | "unclear";

export type DecisionScope = {
  level: "world" | "region" | "country" | "asset";
  label: string;
  countryCode?: string | null;
  symbol?: string | null;
};

export type DecisionSummary = {
  lean: DecisionLean;
  headline: string;
  what: string;
  where: string;
  when: string;
  whySupport: string[];
  whyAgainst: string[];
  howStrong: string;
  evidenceScore: number | null;
  evidenceNote: string;
  whatCouldChange: string[];
  counts: { bullish: number; neutral: number; bearish: number; total: number };
  averageScore: number;
  asOfDate: string | null;
  horizon: string;
  modelVersion: string;
  disclaimer: string;
};

function leanFromScore(score: number, n: number): DecisionLean {
  if (n === 0) return "unclear";
  if (score >= 0.15) return "up";
  if (score <= -0.15) return "down";
  return "mixed";
}

function headlineFor(
  lean: DecisionLean,
  scopeLabel: string,
  whenLabel: string,
): string {
  if (lean === "up") {
    return `${scopeLabel}: mild upward lean for ${whenLabel}.`;
  }
  if (lean === "down") {
    return `${scopeLabel}: mild downward lean for ${whenLabel}.`;
  }
  if (lean === "unclear") {
    return `${scopeLabel}: not enough signal data yet.`;
  }
  return `${scopeLabel}: mixed / wait-and-see for ${whenLabel}.`;
}

function whatFor(
  lean: DecisionLean,
  counts: DecisionSummary["counts"],
): string {
  if (lean === "unclear") {
    return "Tell does not have enough completed signals to form a view.";
  }
  if (lean === "up") {
    return `More assets lean higher (${counts.bullish} up · ${counts.neutral} flat · ${counts.bearish} down). This is a research lean, not a guarantee.`;
  }
  if (lean === "down") {
    return `More assets lean lower (${counts.bullish} up · ${counts.neutral} flat · ${counts.bearish} down). This is a research lean, not a guarantee.`;
  }
  return `Signals disagree or sit near neutral (${counts.bullish} up · ${counts.neutral} flat · ${counts.bearish} down). Waiting for clearer evidence is reasonable.`;
}

function pickDrivers(
  signals: OutlookSignalDto[],
  lean: DecisionLean,
): { support: string[]; against: string[] } {
  const ranked = [...signals].sort(
    (a, b) => Math.abs(b.score) - Math.abs(a.score),
  );
  const support: string[] = [];
  const against: string[] = [];

  for (const signal of ranked) {
    for (const driver of signal.drivers.slice(0, 2)) {
      const text = `${signal.symbol}: ${driver.detail}`;
      const helpsUp = signal.score > 0;
      if (lean === "down") {
        if (!helpsUp && against.length < 3) against.push(text);
        else if (helpsUp && support.length < 2) support.push(text);
      } else if (lean === "up") {
        if (helpsUp && support.length < 3) support.push(text);
        else if (!helpsUp && against.length < 2) against.push(text);
      } else {
        if (helpsUp && support.length < 2) support.push(text);
        else if (!helpsUp && against.length < 2) against.push(text);
      }
      if (support.length >= 3 && against.length >= 2) break;
    }
    if (support.length >= 3 && against.length >= 2) break;
  }

  if (support.length === 0) {
    support.push("No strong supportive drivers in the current sample.");
  }
  if (against.length === 0) {
    against.push("No strong opposing drivers in the current sample.");
  }
  return { support, against };
}

function averageConfidence(signals: OutlookSignalDto[]): number | null {
  const values = signals
    .map((s) => s.confidence)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Build a beginner 5W1H summary from the currently visible signal set. */
export function buildDecisionSummary(input: {
  signals: OutlookSignalDto[];
  horizon: string;
  scope: DecisionScope;
  asOfDate?: string | null;
}): DecisionSummary {
  const horizonInfo = describeHorizon(input.horizon);
  const signals = input.signals;
  const counts = {
    bullish: signals.filter((s) => s.direction === "bullish").length,
    neutral: signals.filter((s) => s.direction === "neutral").length,
    bearish: signals.filter((s) => s.direction === "bearish").length,
    total: signals.length,
  };
  const averageScore =
    counts.total === 0
      ? 0
      : signals.reduce((sum, s) => sum + s.score, 0) / counts.total;
  const lean = leanFromScore(averageScore, counts.total);
  const evidence = averageConfidence(signals);
  const drivers = pickDrivers(signals, lean);
  const asOf =
    input.asOfDate ??
    signals.reduce<string | null>(
      (latest, s) => (!latest || s.asOfDate > latest ? s.asOfDate : latest),
      null,
    );
  const modelVersion = signals[0]?.modelVersion ?? "rules-v1";

  return {
    lean,
    headline: headlineFor(lean, input.scope.label, horizonInfo.beginnerLabel),
    what: whatFor(lean, counts),
    where: input.scope.label,
    when: `${horizonInfo.longLabel}${asOf ? ` · data through ${asOf}` : ""}`,
    whySupport: drivers.support,
    whyAgainst: drivers.against,
    howStrong:
      evidence == null
        ? "Evidence strength unavailable."
        : `Evidence strength ${Math.round(evidence * 100)}/100 across ${counts.total} assets.`,
    evidenceScore: evidence == null ? null : Number(evidence.toFixed(4)),
    evidenceNote:
      "Evidence strength is how complete and decisive the inputs look. It is not a probability that the lean will be correct.",
    whatCouldChange: [
      "A new central-bank release can flip near-term risk appetite.",
      "A sharp VIX jump or curve move can change the US regime label.",
      "Fresh price momentum after the next session can confirm or invalidate this lean.",
    ],
    counts,
    averageScore: Number(averageScore.toFixed(3)),
    asOfDate: asOf,
    horizon: input.horizon,
    modelVersion,
    disclaimer:
      "Research aid only. Past analogues and model leans are not financial advice or guaranteed predictions.",
  };
}
