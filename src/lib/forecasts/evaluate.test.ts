import { describe, expect, it } from "vitest";
import {
  isDirectionCorrect,
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
