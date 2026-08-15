import { describe, expect, it } from "vitest";
import {
  assertAscending,
  changeOverLags,
  indexAtOrBefore,
  mean,
  pctChange,
  stdev,
  trailingWindow,
  valueAtOrBefore,
} from "@/lib/features/series";

const pts = [
  { date: "2024-01-01", value: 100 },
  { date: "2024-01-02", value: 110 },
  { date: "2024-01-03", value: 105 },
];

describe("series helpers", () => {
  it("finds value and index at or before", () => {
    expect(valueAtOrBefore(pts, "2024-01-02")).toEqual(pts[1]);
    expect(valueAtOrBefore(pts, "2023-12-31")).toBeNull();
    expect(indexAtOrBefore(pts, "2024-01-03")).toBe(2);
    expect(indexAtOrBefore(pts, "2024-01-01")).toBe(0);
  });

  it("computes trailing window and pct change", () => {
    expect(trailingWindow(pts, "2024-01-03", 2)).toEqual([pts[1], pts[2]]);
    expect(pctChange(100, 110)).toBeCloseTo(0.1);
    expect(changeOverLags(pts, "2024-01-03", 2)).toBeCloseTo(0.05);
  });

  it("mean and sample stdev", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(stdev([1, 2, 3])).toBeCloseTo(1);
  });

  it("assertAscending throws on unsorted", () => {
    expect(() =>
      assertAscending([
        { date: "2024-01-02", value: 1 },
        { date: "2024-01-01", value: 2 },
      ]),
    ).toThrow(/sorted ascending/);
  });
});
