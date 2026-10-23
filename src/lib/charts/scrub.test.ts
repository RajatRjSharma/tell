import { describe, expect, it } from "vitest";
import {
  formatChartDate,
  nearestIndex,
  tooltipAlign,
} from "@/lib/charts/scrub";
import { explainMacroValue, formatSignedPct } from "@/lib/charts/explain";

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
