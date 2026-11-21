import { describe, expect, it } from "vitest";
import { NO_CHANGES, periodChanges, weightedChanges } from "./changes";

describe("periodChanges", () => {
  it("measures 1, 5 and 21 bars back", () => {
    const closes = Array.from({ length: 22 }, (_, index) => 100 + index);
    const changes = periodChanges(closes);
    expect(changes["1d"]).toBeCloseTo(121 / 120 - 1);
    expect(changes["1w"]).toBeCloseTo(121 / 116 - 1);
    expect(changes["1m"]).toBeCloseTo(121 / 100 - 1);
  });

  it("leaves periods without enough history null", () => {
    expect(periodChanges([100, 102])).toEqual({
      "1d": expect.closeTo(0.02),
      "1w": null,
      "1m": null,
    });
    expect(periodChanges([])).toEqual(NO_CHANGES);
  });

  it("ignores a non-positive base", () => {
    expect(periodChanges([0, 5])["1d"]).toBeNull();
  });
});

describe("weightedChanges", () => {
  it("weights by size and skips missing or empty parts", () => {
    const result = weightedChanges([
      { value: 3, changes: { "1d": 0.01, "1w": null, "1m": 0.1 } },
      { value: 1, changes: { "1d": -0.03, "1w": null, "1m": null } },
      { value: 0, changes: { "1d": 0.5, "1w": 0.5, "1m": 0.5 } },
    ]);
    expect(result["1d"]).toBeCloseTo(0);
    expect(result["1w"]).toBeNull();
    expect(result["1m"]).toBeCloseTo(0.1);
  });
});
