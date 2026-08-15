import { describe, expect, it } from "vitest";
import { extractCitations, formatResearchContext } from "@/lib/ai/context";
import type { ResearchContext } from "@/lib/ai/types";

const sample: ResearchContext = {
  asOf: "2026-08-14",
  regime: "inflationary",
  horizon: "1d",
  symbol: "SPY",
  signals: [
    {
      symbol: "SPY",
      horizon: "1d",
      direction: "neutral",
      score: -0.07,
      confidence: 0.61,
      drivers: ["regime: inflation is mixed for equities"],
    },
  ],
  macro: [
    {
      indicatorId: "CPI",
      observedFor: "2026-07-01",
      value: 314.2,
      source: "FRED",
    },
  ],
  events: [
    {
      date: "2026-07-29",
      source: "Fed",
      title: "Federal Reserve issues FOMC statement",
      type: "policy",
    },
  ],
};

describe("formatResearchContext", () => {
  it("serializes regime, signals, macro, and events", () => {
    const text = formatResearchContext(sample);
    expect(text).toContain("regime=inflationary");
    expect(text).toContain("SPY 1d: neutral");
    expect(text).toContain("CPI 2026-07-01=314.2");
    expect(text).toContain("recent_policy_events:");
    expect(text).toContain("FOMC statement");
  });
});

describe("extractCitations", () => {
  it("returns compact evidence tags", () => {
    expect(extractCitations(sample)).toEqual(
      expect.arrayContaining([
        "regime:inflationary",
        "signals_as_of:2026-08-14",
        "SPY:1d:neutral",
        "CPI:2026-07-01",
        "event:Fed:2026-07-29:Federal Reserve issues FOMC statement",
      ]),
    );
  });
});
