import { describe, expect, it } from "vitest";
import {
  formatChartDate,
  nearestIndex,
  tooltipAlign,
} from "@/lib/charts/scrub";
import {
  explainConfidence,
  explainImpactCell,
  explainMacroValue,
  explainScore,
  formatSignedPct,
  impactIntensity,
} from "@/lib/charts/explain";

describe("nearestIndex", () => {
  it("finds the closest x, preferring the earlier point on ties", () => {
    const xs = [0, 10, 20, 30];
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 14)).toBe(1);
    expect(nearestIndex(xs, 15)).toBe(1);
    expect(nearestIndex(xs, 16)).toBe(2);
    expect(nearestIndex(xs, 99)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe("tooltipAlign", () => {
  it("anchors near the edges", () => {
    expect(tooltipAlign(0.05)).toBe("start");
    expect(tooltipAlign(0.5)).toBe("center");
    expect(tooltipAlign(0.95)).toBe("end");
  });
});

describe("formatChartDate", () => {
  it("formats days and months", () => {
    expect(formatChartDate("2026-10-02")).toBe("2 Oct 2026");
    expect(formatChartDate("2026-10-01", "month")).toBe("Oct 2026");
    expect(formatChartDate("bad")).toBe("bad");
  });
});

describe("explainMacroValue", () => {
  it("reads VIX and the yield curve in plain language", () => {
    expect(explainMacroValue("VIXCLS", 12)).toMatch(/^Calm/);
    expect(explainMacroValue("VIXCLS", 34)).toMatch(/^Stress/);
    expect(explainMacroValue("T10Y2Y", -0.3)).toMatch(/^Inverted/);
    expect(explainMacroValue("T10Y2Y", 0.8)).toMatch(/^Normal/);
  });

  it("describes month-on-month changes", () => {
    expect(explainMacroValue("CPI", 101, 100)).toBe(
      "Prices +1.00% vs the prior month.",
    );
    expect(explainMacroValue("POLICY_RATE", 5.25, 5.5)).toBe(
      "Cut 0.25 pp vs the prior month.",
    );
    expect(explainMacroValue("POLICY_RATE", 5.5, 5.5)).toMatch(/Unchanged/);
    expect(explainMacroValue("CPI_YOY_M", 2.1)).toMatch(/target/);
  });

  it("formats signed percents", () => {
    expect(formatSignedPct(0.0342)).toBe("+3.42%");
    expect(formatSignedPct(-0.01)).toBe("−1.00%");
  });
});

describe("explainScore", () => {
  it("names the zone and strength", () => {
    expect(explainScore(0.05)).toMatch(/neutral zone/);
    expect(explainScore(-0.14)).toMatch(/neutral zone/);
    expect(explainScore(0.2)).toMatch(/Mild bullish/);
    expect(explainScore(-0.5)).toMatch(/Clear bearish/);
    expect(explainScore(0.9)).toMatch(/Strong bullish/);
  });

  it("reads evidence levels", () => {
    expect(explainConfidence(null)).toBe("");
    expect(explainConfidence(0.3)).toMatch(/Thin/);
    expect(explainConfidence(0.8)).toMatch(/Broad/);
  });
});

describe("explainImpactCell", () => {
  const base = { symbol: "SPY", horizon: "1w", source: "Fed" };

  it("describes typical move and direction", () => {
    const text = explainImpactCell({
      ...base,
      n: 20,
      median: 0.0042,
      hitRateUp: 0.65,
    });
    expect(text).toContain("SPY, 1 week after Fed releases");
    expect(text).toContain("+0.42%");
    expect(text).toContain("usually rose");
    expect(text).not.toContain("Small sample");
  });

  it("flags thin and empty samples", () => {
    expect(
      explainImpactCell({ ...base, n: 3, median: -0.01, hitRateUp: 0.5 }),
    ).toMatch(/coin flip.*Small sample/);
    expect(
      explainImpactCell({ ...base, n: 0, median: null, hitRateUp: null }),
    ).toMatch(/no usable price data/);
  });

  it("scales tint to the column's largest move", () => {
    expect(impactIntensity(0.01, 0.02)).toBeCloseTo(0.5);
    expect(impactIntensity(-0.04, 0.02)).toBe(1);
    expect(impactIntensity(null, 0.02)).toBe(0);
  });
});
