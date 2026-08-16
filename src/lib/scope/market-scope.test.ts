import { describe, expect, it } from "vitest";
import {
  buildMarketScopes,
  countryMatchesScope,
  resolveMarketScope,
} from "@/lib/scope/market-scope";

const countries = [
  { code: "US", name: "United States", region: "North America" },
  { code: "IN", name: "India", region: "Asia" },
  { code: "JP", name: "Japan", region: "Asia" },
];

describe("market scopes", () => {
  const scopes = buildMarketScopes(countries);

  it("builds world, region, and country options", () => {
    expect(scopes.map((scope) => scope.value)).toEqual([
      "world",
      "region:Asia",
      "region:North America",
      "country:IN",
      "country:JP",
      "country:US",
    ]);
  });

  it("matches countries at each hierarchy level", () => {
    expect(
      countryMatchesScope("US", resolveMarketScope("world", scopes), countries),
    ).toBe(true);
    expect(
      countryMatchesScope(
        "JP",
        resolveMarketScope("region:Asia", scopes),
        countries,
      ),
    ).toBe(true);
    expect(
      countryMatchesScope(
        "US",
        resolveMarketScope("region:Asia", scopes),
        countries,
      ),
    ).toBe(false);
    expect(
      countryMatchesScope(
        "IN",
        resolveMarketScope("country:IN", scopes),
        countries,
      ),
    ).toBe(true);
  });

  it("falls back to world for unknown values", () => {
    expect(resolveMarketScope("country:ZZ", scopes).kind).toBe("world");
  });
});
