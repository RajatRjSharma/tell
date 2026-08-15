import { describe, expect, it } from "vitest";
import {
  buildSparklinePath,
  formatSparkDelta,
  formatSparkValue,
  seriesDelta,
} from "@/lib/macro/sparklines";

describe("buildSparklinePath", () => {
  it("returns empty for no values", () => {
    expect(buildSparklinePath([], 80, 28)).toBe("");
  });

  it("builds a polyline for multiple values", () => {
    const path = buildSparklinePath([1, 2, 3], 80, 28);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain(" L ");
  });
});

describe("seriesDelta", () => {
  it("computes step and range deltas", () => {
    const delta = seriesDelta([
      { date: "2026-01-01", value: 100 },
      { date: "2026-02-01", value: 102 },
      { date: "2026-03-01", value: 101 },
    ]);
    expect(delta.change).toBe(-1);
    expect(delta.rangeChange).toBe(1);
  });
});

describe("formatters", () => {
  it("formats units", () => {
    expect(formatSparkValue(18.4, "level")).toBe("18.4");
    expect(formatSparkValue(-0.15, "percent")).toBe("-0.15");
    expect(formatSparkDelta(0.2, "index")).toBe("+0.20");
  });
});
