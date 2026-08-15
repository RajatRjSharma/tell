import { describe, expect, it } from "vitest";
import {
  horizonToBars,
  momentumFieldForBars,
  parseHorizons,
} from "@/lib/signals/horizons";

describe("horizonToBars", () => {
  it("maps presets and custom Nd", () => {
    expect(horizonToBars("1d")).toBe(1);
    expect(horizonToBars("1w")).toBe(5);
    expect(horizonToBars("1m")).toBe(21);
    expect(horizonToBars("10d")).toBe(10);
    expect(horizonToBars("2w")).toBe(10);
  });

  it("rejects bad tokens", () => {
    expect(() => horizonToBars("1h")).toThrow(/Unknown horizon/);
    expect(() => horizonToBars("0d")).toThrow(/out of range/);
  });
});

describe("parseHorizons", () => {
  it("defaults and dedupes", () => {
    expect(parseHorizons(undefined)).toEqual(["1d", "1w", "1m"]);
    expect(parseHorizons("1d, 1w, 1d, 10d")).toEqual(["1d", "1w", "10d"]);
  });
});

describe("momentumFieldForBars", () => {
  it("picks the closest return feature", () => {
    expect(momentumFieldForBars(1)).toBe("return1d");
    expect(momentumFieldForBars(5)).toBe("return5d");
    expect(momentumFieldForBars(21)).toBe("return21d");
  });
});
