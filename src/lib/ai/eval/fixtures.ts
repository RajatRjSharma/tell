import type { ResearchContext } from "@/lib/ai/types";

export const spyNeutralContext: ResearchContext = {
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
      drivers: [
        "regime: inflation is mixed for equities",
        "momentum: return1d=-0.20%",
      ],
    },
  ],
  macro: [
    {
      indicatorId: "CPI",
      observedFor: "2026-07-01",
      value: 314.2,
      source: "FRED",
    },
    {
      indicatorId: "FEDFUNDS",
      observedFor: "2026-07-01",
      value: 4.33,
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

export const tltBearishContext: ResearchContext = {
  asOf: "2026-08-14",
  regime: "inflationary",
  horizon: "1w",
  symbol: "TLT",
  signals: [
    {
      symbol: "TLT",
      horizon: "1w",
      direction: "bearish",
      score: -0.36,
      confidence: 0.8,
      drivers: [
        "regime: inflationary: higher rates pressure long duration",
        "momentum: return5d=-1.10%",
      ],
    },
  ],
  macro: [
    {
      indicatorId: "DGS10",
      observedFor: "2026-08-13",
      value: 4.25,
      source: "FRED",
    },
  ],
  events: [],
};

export const marketOverviewContext: ResearchContext = {
  asOf: "2026-08-14",
  regime: "inflationary",
  horizon: "1d",
  symbol: null,
  signals: [
    {
      symbol: "GLD",
      horizon: "1d",
      direction: "bullish",
      score: 0.36,
      confidence: 0.8,
      drivers: ["regime: inflation regime can support commodities"],
    },
    {
      symbol: "TLT",
      horizon: "1d",
      direction: "bearish",
      score: -0.39,
      confidence: 0.81,
      drivers: ["regime: inflationary: higher rates pressure long duration"],
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
  events: [],
};

export const emptyContext: ResearchContext = {
  asOf: null,
  regime: null,
  horizon: "1d",
  symbol: "ZZZ",
  signals: [],
  macro: [],
  events: [],
};
