import { describe, expect, it } from "vitest";
import { assets, countries, indicators } from "@/data/seed";
import { ASSET_CLASSES, ASSET_GROUP_LABELS } from "@/lib/assets/classes";

describe("seed data", () => {
  it("gives every asset a seeded home country", () => {
    const codes = new Set(countries.map((c) => c.code));
    expect(codes.size).toBe(countries.length);
    for (const asset of assets) {
      if (asset.country_code) expect(codes).toContain(asset.country_code);
    }
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
      expect(ASSET_CLASSES.map((c) => c.id)).toContain(asset.asset_class);
      expect(asset.asset_group).toBeTruthy();
      expect(ASSET_GROUP_LABELS[asset.asset_group!]).toBeTruthy();
    }
  });

  it("does not reuse retired symbols", () => {
    const symbols = new Set<string>(assets.map((a) => a.symbol));
    expect(symbols.has("GLD")).toBe(false);
    expect(symbols.has("USO")).toBe(false);
  });
});
