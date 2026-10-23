import { describe, expect, it } from "vitest";
import {
  dailyVolatility,
  isDirectionCorrect,
  neutralBandFor,
  neutralBandForBars,
  evaluateSignalOutcome,
  summarizeOutcomes,
} from "@/lib/forecasts/evaluate";

describe("neutralBandForBars", () => {
  it("widens with horizon", () => {
    expect(neutralBandForBars(1)).toBeCloseTo(0.002);
    expect(neutralBandForBars(4)).toBeCloseTo(0.004);
  });
});

function alternating(n: number, step: number) {
  let value = 100;
  return Array.from({ length: n }, (_, i) => {
    value *= i % 2 === 0 ? 1 + step : 1 - step;
    return { date: `2026-01-${String(i + 1).padStart(2, "0")}`, value };
  });
}

describe("dailyVolatility", () => {
  it("measures typical daily moves from past closes only", () => {
    const closes = alternating(30, 0.01);
    expect(dailyVolatility(closes, 29)).toBeGreaterThan(0.009);
    expect(dailyVolatility(closes, 29)).toBeLessThan(0.011);
  });

  it("needs enough history", () => {
    expect(dailyVolatility(alternating(10, 0.01), 9)).toBeNull();
    expect(dailyVolatility(alternating(30, 0.01), -1)).toBeNull();
  });
});

describe("neutralBandFor", () => {
  it("scales with the instrument's own volatility", () => {
    expect(neutralBandFor(1, 0.001)).toBeCloseTo(0.0005);
    expect(neutralBandFor(4, 0.02)).toBeCloseTo(0.02);
  });

  it("falls back to the fixed band without volatility", () => {
    expect(neutralBandFor(4, null)).toBeCloseTo(neutralBandForBars(4));
  });

  it("stops quiet instruments from passing neutral calls for free", () => {
    const quiet = alternating(70, 0.001);
    const at = quiet[64]!.date;
    const outcome = evaluateSignalOutcome("neutral", quiet, at, "1d");
    expect(outcome?.neutralBand).toBeLessThan(0.001);
    expect(outcome?.correct).toBe(false);
  });
});

describe("isDirectionCorrect", () => {
  it("scores directional and neutral outcomes", () => {
    expect(isDirectionCorrect("bullish", 0.01, 0.002)).toBe(true);
    expect(isDirectionCorrect("bullish", -0.01, 0.002)).toBe(false);
    expect(isDirectionCorrect("bearish", -0.01, 0.002)).toBe(true);
    expect(isDirectionCorrect("neutral", 0.001, 0.002)).toBe(true);
    expect(isDirectionCorrect("neutral", 0.01, 0.002)).toBe(false);
  });
});

describe("evaluateSignalOutcome", () => {
  it("uses forward closes over the horizon", () => {
    const closes = [
      { date: "2026-08-01", value: 100 },
      { date: "2026-08-02", value: 101 },
      { date: "2026-08-03", value: 103 },
    ];

    const outcome = evaluateSignalOutcome(
      "bullish",
      closes,
      "2026-08-01",
      "1d",
    );
    expect(outcome?.actualReturn).toBeCloseTo(0.01);
    expect(outcome?.correct).toBe(true);
  });
});

describe("summarizeOutcomes", () => {
  it("computes hit rate", () => {
    const stats = summarizeOutcomes([
      { direction: "bullish", actualReturn: 0.01, correct: 1 },
      { direction: "bearish", actualReturn: 0.02, correct: 0 },
      { direction: "neutral", actualReturn: null, correct: null },
    ]);
    expect(stats.n).toBe(2);
    expect(stats.hitRate).toBeCloseTo(0.5);
  });
});
