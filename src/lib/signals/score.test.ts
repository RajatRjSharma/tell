import { describe, expect, it } from "vitest";
import { regimeBias, scoreSignal } from "@/lib/signals/score";
import type { MarketFeatures } from "@/lib/features/market";

const baseMarket: MarketFeatures = {
  symbol: "SPY",
  asOf: "2024-06-01",
  close: 500,
  return1d: 0.005,
  return5d: 0.02,
  return21d: 0.04,
  vol21d: 0.15,
  drawdown63d: -0.01,
};

describe("regimeBias", () => {
  it("is bearish equities in risk_off and supportive of rates", () => {
    expect(regimeBias("risk_off", "equity").bias).toBeLessThan(0);
    expect(regimeBias("risk_off", "rates").bias).toBeGreaterThan(0);
  });
});

describe("scoreSignal", () => {
  it("scores expansion + positive momentum as bullish for SPY", () => {
    const s = scoreSignal({
      symbol: "SPY",
      assetClass: "equity",
      horizon: "1w",
      asOfDate: "2024-06-01",
      regime: "expansion",
      market: baseMarket,
    });
    expect(s.direction).toBe("bullish");
    expect(s.score).toBeGreaterThan(0);
    expect(s.drivers.length).toBeGreaterThan(0);
    expect(s.modelVersion).toBe("rules-v1");
  });

  it("scores risk_off equities as bearish", () => {
    const s = scoreSignal({
      symbol: "SPY",
      assetClass: "equity",
      horizon: "1d",
      asOfDate: "2024-06-01",
      regime: "risk_off",
      market: {
        ...baseMarket,
        return1d: -0.02,
        return5d: -0.05,
        vol21d: 0.4,
        drawdown63d: -0.12,
      },
    });
    expect(s.direction).toBe("bearish");
    expect(s.score).toBeLessThan(0);
  });

  it("supports custom Nd horizons", () => {
    const s = scoreSignal({
      symbol: "TLT",
      assetClass: "rates",
      horizon: "10d",
      asOfDate: "2024-06-01",
      regime: "slowdown",
      market: { ...baseMarket, symbol: "TLT", return5d: 0.01 },
    });
    expect(s.horizon).toBe("10d");
    expect(["bullish", "neutral", "bearish"]).toContain(s.direction);
  });
});
