import { describe, expect, it } from "vitest";
import {
  changeIntensity,
  formatChange,
  formatMapValue,
  formatShare,
  formatUsd,
} from "./format";

describe("map formatting", () => {
  it("scales colour intensity per period and clamps", () => {
    expect(changeIntensity(0.015, "1d")).toBeCloseTo(0.5);
    expect(changeIntensity(0.015, "1m")).toBeCloseTo(0.15);
    expect(changeIntensity(-0.2, "1w")).toBe(-1);
    expect(changeIntensity(null, "1d")).toBeNull();
    expect(changeIntensity(Number.NaN, "1d")).toBeNull();
  });

  it("formats signed percentage changes", () => {
    expect(formatChange(0.0123)).toBe("+1.23%");
    expect(formatChange(-0.155)).toBe("-15.5%");
    expect(formatChange(0)).toBe("0.00%");
    expect(formatChange(null)).toBe("n/a");
  });

  it("formats dollar sizes and units", () => {
    expect(formatUsd(67.4e12)).toBe("$67.4T");
    expect(formatUsd(3.15e12)).toBe("$3.15T");
    expect(formatUsd(471e9)).toBe("$471B");
    expect(formatUsd(52.3e9)).toBe("$52.3B");
    expect(formatUsd(820e6)).toBe("$820M");
    expect(formatMapValue(0.374, "share")).toBe("37.4% of S&P 500");
    expect(formatMapValue(1, "equal")).toBeNull();
  });

  it("formats shares of a parent", () => {
    expect(formatShare(1, 4)).toBe("25%");
    expect(formatShare(1, 30)).toBe("3.3%");
    expect(formatShare(1, 0)).toBeNull();
  });
});
