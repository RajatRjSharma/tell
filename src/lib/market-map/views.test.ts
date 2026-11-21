import { describe, expect, it } from "vitest";
import {
  bitcoinSupply,
  COUNTRY_EQUITY,
  ETH_SUPPLY,
  GLOBAL_BONDS_USD,
  GLOBAL_EQUITY_USD,
  GOLD_STOCK_TONNES,
  SIZE_SOURCES,
  TROY_OUNCES_PER_TONNE,
} from "@/data/market-sizes";
import { assets } from "@/data/seed";
import { NO_CHANGES } from "./changes";
import {
  buildMapViews,
  countryName,
  type MapInputs,
  type MapTile,
  type MapView,
  type PriceInfo,
  priceSymbols,
  referenceRequests,
} from "./views";

function price(close: number, refCloses: Record<string, number> = {}) {
  return {
    close,
    changes: { "1d": 0.01, "1w": 0.02, "1m": 0.03 },
    refCloses,
  } satisfies PriceInfo;
}

function inputs(overrides: Partial<MapInputs> = {}): MapInputs {
  return { asOf: "2026-11-20", prices: {}, companies: [], ...overrides };
}

function view(all: MapView[], id: MapView["id"]): MapView {
  const found = all.find((item) => item.id === id);
  if (!found) throw new Error(`missing view ${id}`);
  return found;
}

function tile(tiles: MapTile[], id: string): MapTile | undefined {
  for (const item of tiles) {
    if (item.id === id) return item;
    const nested = item.children ? tile(item.children, id) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function leaves(tiles: MapTile[]): MapTile[] {
  return tiles.flatMap((item) =>
    item.children?.length ? leaves(item.children) : [item],
  );
}

const usEquity = COUNTRY_EQUITY.find((row) => row.country === "US")!;
const usAsOf = SIZE_SOURCES[usEquity.source].asOf;

describe("buildMapViews", () => {
  it("returns the five views in menu order", () => {
    expect(buildMapViews(inputs()).map((item) => item.id)).toEqual([
      "asset-classes",
      "countries",
      "companies",
      "us-sectors",
      "markets",
    ]);
  });

  it("keeps world totals and drops unpriced gold and crypto", () => {
    const classes = view(buildMapViews(inputs()), "asset-classes");
    expect(classes.tiles.map((item) => item.id)).toEqual(["equities", "bonds"]);
    expect(tile(classes.tiles, "equities")!.value).toBeCloseTo(
      GLOBAL_EQUITY_USD,
      -6,
    );
    expect(tile(classes.tiles, "bonds")!.value).toBeCloseTo(
      GLOBAL_BONDS_USD,
      -6,
    );
    expect(tile(classes.tiles, "equity-US")!.changes).toEqual(NO_CHANGES);
  });

  it("rolls a dated size forward with its proxy", () => {
    const all = buildMapViews(
      inputs({ prices: { SPY: price(110, { [usAsOf]: 100 }) } }),
    );
    const classes = view(all, "asset-classes");
    const us = tile(classes.tiles, "equity-US")!;
    expect(us.value).toBeCloseTo(usEquity.usd * 1.1, -3);
    expect(us.changes["1d"]).toBe(0.01);
    expect(tile(classes.tiles, "equities")!.value).toBeGreaterThan(
      GLOBAL_EQUITY_USD,
    );
    expect(tile(view(all, "countries").tiles, "equity-US")!.value).toBeCloseTo(
      us.value,
    );
  });

  it("sizes gold from tonnes and crypto from supply", () => {
    const classes = view(
      buildMapViews(
        inputs({
          prices: {
            GOLD: price(4000),
            BTCUSD: price(100_000),
            ETHUSD: price(4_000),
          },
        }),
      ),
      "asset-classes",
    );
    const tonnes = GOLD_STOCK_TONNES.reduce((sum, row) => sum + row.tonnes, 0);
    expect(tile(classes.tiles, "gold")!.value).toBeCloseTo(
      tonnes * TROY_OUNCES_PER_TONNE * 4000,
      -6,
    );
    expect(tile(classes.tiles, "crypto-BTCUSD")!.value).toBeCloseTo(
      bitcoinSupply("2026-11-20") * 100_000,
      -3,
    );
    expect(tile(classes.tiles, "crypto-ETHUSD")!.value).toBeCloseTo(
      ETH_SUPPLY * 4_000,
      -3,
    );
  });

  it("groups companies by country then sector and skips missing caps", () => {
    const snapshot = (symbol: string, marketCapUsd: number) => ({
      symbol,
      marketCapUsd,
      close: 1,
      changes: { "1d": 0.02, "1w": null, "1m": null },
      asOfDate: "2026-11-20",
    });
    const companies = view(
      buildMapViews(
        inputs({
          companies: [
            snapshot("AAPL", 3e12),
            snapshot("MSFT", 1e12),
            snapshot("TSM", 1e12),
          ],
        }),
      ),
      "companies",
    );
    expect(companies.tiles.map((item) => item.id).sort()).toEqual([
      "country-TW",
      "country-US",
    ]);
    const us = tile(companies.tiles, "country-US")!;
    expect(us.value).toBe(4e12);
    expect(us.changes["1d"]).toBeCloseTo(0.02);
    expect(us.children!.every((item) => item.children?.length)).toBe(true);
    expect(leaves(companies.tiles)).toHaveLength(3);
    expect(tile(companies.tiles, "co-NVDA")).toBeUndefined();
  });

  it("normalises US sector weights to one", () => {
    const sectors = view(buildMapViews(inputs()), "us-sectors");
    const total = sectors.tiles.reduce((sum, item) => sum + item.value, 0);
    expect(total).toBeCloseTo(1);
    expect(sectors.tiles[0]!.id).toBe("sector-XLK");
  });

  it("shows every tracked instrument once at equal size", () => {
    const markets = view(buildMapViews(inputs()), "markets");
    const ids = leaves(markets.tiles).map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(assets.length);
    expect(leaves(markets.tiles).every((item) => item.value === 1)).toBe(true);
  });
});

describe("map inputs", () => {
  it("asks for proxies that exist in the universe", () => {
    const symbols = new Set(priceSymbols());
    for (const ref of referenceRequests()) {
      expect(symbols.has(ref.symbol), ref.symbol).toBe(true);
    }
    expect(symbols.has("GOLD")).toBe(true);
    expect(symbols.has("BTCUSD")).toBe(true);
  });

  it("names seed and non-seed countries", () => {
    expect(countryName("US")).toBe("United States");
    expect(countryName("NL")).toBe("Netherlands");
  });
});

describe("bitcoinSupply", () => {
  it("follows the post-2024 issuance and caps at 21M", () => {
    expect(bitcoinSupply("2024-04-20")).toBe(19_687_500);
    expect(bitcoinSupply("2025-04-20")).toBe(19_687_500 + 365 * 450);
    expect(bitcoinSupply("2200-01-01")).toBe(21_000_000);
    expect(bitcoinSupply("")).toBe(19_687_500);
  });
});
