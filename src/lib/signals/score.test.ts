import { describe, expect, it } from "vitest";
import {
  regimeBias,
  scoreSignal,
  SIGNAL_MODEL_VERSION,
} from "@/lib/signals/score";
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

  it("flips the dollar view by quote direction", () => {
    const dollar = regimeBias("expansion", "fx", "DXY").bias;
    expect(dollar).toBeLessThan(0);
    expect(regimeBias("expansion", "fx", "USDCAD").bias).toBe(dollar);
    expect(regimeBias("expansion", "fx", "EURUSD").bias).toBe(-dollar);
  });

  it("treats yen and franc as safe havens in risk_off", () => {
    // USDJPY falling = yen strengthening.
    expect(regimeBias("risk_off", "fx", "USDJPY").bias).toBeLessThan(0);
    expect(regimeBias("risk_off", "fx", "USDCHF").bias).toBeLessThan(0);
    expect(regimeBias("risk_off", "fx", "USDINR").bias).toBeGreaterThan(0);
  });

  it("covers the new classes and stays flat in a neutral regime", () => {
    expect(regimeBias("risk_off", "crypto").bias).toBeLessThan(0);
    expect(regimeBias("risk_off", "credit").bias).toBeLessThan(0);
    expect(regimeBias("inflationary", "commodity").bias).toBeGreaterThan(0);
    expect(regimeBias("neutral", "crypto").bias).toBe(0);
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
    expect(s.modelVersion).toBe(SIGNAL_MODEL_VERSION);
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
