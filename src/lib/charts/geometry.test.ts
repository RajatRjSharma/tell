import { describe, expect, it } from "vitest";
import {
  buildChartGeometry,
  seriesChangePct,
  type ChartBar,
} from "@/lib/charts/geometry";

const bars: ChartBar[] = [
  {
    date: "2026-08-01",
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
  },
  {
    date: "2026-08-02",
    open: 100,
    high: 102,
    low: 100,
    close: 102,
    volume: 1,
  },
  {
    date: "2026-08-03",
    open: 102,
    high: 103,
    low: 101,
    close: 101,
    volume: 1,
  },
];

describe("seriesChangePct", () => {
  it("computes first-to-last change", () => {
    expect(seriesChangePct(bars)).toBeCloseTo(0.01);
  });
});

describe("buildChartGeometry", () => {
  it("builds line and area paths", () => {
    const geometry = buildChartGeometry(bars, 320, 140);
    expect(geometry.points).toHaveLength(3);
    expect(geometry.linePath.startsWith("M")).toBe(true);
    expect(geometry.areaPath.endsWith("Z")).toBe(true);
    expect(geometry.min).toBe(100);
    expect(geometry.max).toBe(102);
  });
});
