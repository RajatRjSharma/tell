import { describe, expect, it } from "vitest";
import { assets, countries, indicators } from "@/data/seed";

describe("seed data", () => {
  it("includes the MVP countries", () => {
    expect(countries.map((c) => c.code).sort()).toEqual([
      "DE",
      "GB",
      "IN",
      "JP",
      "US",
    ]);
  });

  it("has unique indicator ids", () => {
    const ids = indicators.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique asset symbols with source symbols", () => {
    const symbols = assets.map((a) => a.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    for (const asset of assets) {
      expect(asset.source_symbol.length).toBeGreaterThan(0);
      expect(["equity", "fx", "commodity", "rates"]).toContain(
        asset.asset_class,
      );
    }
  });
});
