import { describe, expect, it } from "vitest";
import { describeHorizon } from "@/lib/decision/horizons";
import { buildDecisionSummary } from "@/lib/decision/summary";
import type { OutlookSignalDto } from "@/lib/api/outlook";

function signal(
  partial: Partial<OutlookSignalDto> &
    Pick<OutlookSignalDto, "symbol" | "direction" | "score">,
): OutlookSignalDto {
  return {
    horizon: "1d",
    asOfDate: "2026-08-14",
    confidence: 0.6,
    drivers: [
      {
        code: "regime",
        detail: "inflationary: mixed for equities",
        weight: 0.4,
      },
      { code: "momentum", detail: "return1d=+0.40%", weight: 0.45 },
    ],
    regime: "inflationary",
    modelVersion: "rules-v1",
    ...partial,
  };
}

describe("describeHorizon", () => {
  it("maps presets to trading-session language", () => {
    expect(describeHorizon("1d").shortLabel).toBe("Next session");
    expect(describeHorizon("1w").bars).toBe(5);
    expect(describeHorizon("1m").beginnerLabel).toContain("month");
  });
});

describe("buildDecisionSummary", () => {
  it("builds a mixed world summary with 5W1H fields", () => {
    const summary = buildDecisionSummary({
      horizon: "1d",
      scope: { level: "world", label: "World · all loaded markets" },
      signals: [
        signal({ symbol: "SPY", direction: "bullish", score: 0.2 }),
        signal({ symbol: "TLT", direction: "bearish", score: -0.3 }),
        signal({
          symbol: "GLD",
          direction: "neutral",
          score: 0.05,
          drivers: [{ code: "regime", detail: "gold hedge", weight: 0.1 }],
        }),
      ],
    });

    expect(summary.lean).toBe("mixed");
    expect(summary.where).toContain("World");
    expect(summary.when).toContain("trading session");
    expect(summary.whySupport.length).toBeGreaterThan(0);
    expect(summary.whyAgainst.length).toBeGreaterThan(0);
    expect(summary.evidenceNote.toLowerCase()).toContain("not a probability");
    expect(summary.counts).toEqual({
      bullish: 1,
      neutral: 1,
      bearish: 1,
      total: 3,
    });
  });

  it("leans up when the average score is constructive", () => {
    const summary = buildDecisionSummary({
      horizon: "1w",
      scope: { level: "country", label: "US equities", countryCode: "US" },
      signals: [
        signal({
          symbol: "SPY",
          direction: "bullish",
          score: 0.4,
          horizon: "1w",
        }),
        signal({
          symbol: "GLD",
          direction: "bullish",
          score: 0.3,
          horizon: "1w",
        }),
      ],
    });
    expect(summary.lean).toBe("up");
    expect(summary.headline.toLowerCase()).toContain("upward");
  });
});
