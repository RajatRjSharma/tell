import { describe, expect, it } from "vitest";
import { toAssetReadingUpserts } from "@/lib/asset-readings";

describe("toAssetReadingUpserts", () => {
  it("binds bars to a symbol", () => {
    const rows = toAssetReadingUpserts("SPY", [
      {
        date: "2024-01-01",
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
      },
    ]);

    expect(rows).toEqual([
      {
        symbol: "SPY",
        date: "2024-01-01",
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 10,
      },
    ]);
  });
});
