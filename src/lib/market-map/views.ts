import { companies, type MapCompany } from "@/data/companies";
import {
  BOND_REGION_SHARES,
  bitcoinSupply,
  COUNTRY_EQUITY,
  ETH_SUPPLY,
  GLOBAL_BONDS_USD,
  GLOBAL_EQUITY_USD,
  GOLD_STOCK_TONNES,
  SIZE_SOURCES,
  type SizeSourceId,
  TROY_OUNCES_PER_TONNE,
  US_SECTOR_WEIGHTS,
} from "@/data/market-sizes";
import { assets, countries } from "@/data/seed";
import { ASSET_CLASSES, ASSET_GROUP_LABELS } from "@/lib/assets/classes";
import { NO_CHANGES, type PeriodChanges, weightedChanges } from "./changes";
import type { CompanySnapshot } from "./company-snapshots";

export type MapTile = {
  id: string;
  label: string;
  /** Longer name for the tooltip when the tile label is abbreviated. */
  name?: string;
  value: number;
  changes: PeriodChanges;
  /** How the size or colour was derived, shown in the tooltip. */
  note?: string;
  children?: MapTile[];
};

export type MapUnit = "usd" | "share" | "equal";

export type MapViewId =
  "asset-classes" | "countries" | "companies" | "us-sectors" | "markets";

export type MapView = {
  id: MapViewId;
  title: string;
  description: string;
  unit: MapUnit;
  tiles: MapTile[];
  sources: SizeSourceId[];
};

export type PriceInfo = {
  close: number;
  changes: PeriodChanges;
  /** Close on or just before each reference date the sizes need. */
  refCloses: Record<string, number>;
};

export type MapInputs = {
  asOf: string;
  prices: Record<string, PriceInfo>;
  companies: CompanySnapshot[];
};

/** Proxy closes the sizes are rolled forward from, keyed by date. */
export function referenceRequests(): Array<{ symbol: string; date: string }> {
  return [
    ...COUNTRY_EQUITY.map((row) => ({
      symbol: row.proxy,
      date: SIZE_SOURCES[row.source].asOf,
    })),
    ...US_SECTOR_WEIGHTS.map((row) => ({
      symbol: row.proxy,
      date: SIZE_SOURCES.spdji.asOf,
    })),
  ];
}

/** Symbols whose latest close and moves the map needs. */
export function priceSymbols(): string[] {
  return assets.map((asset) => asset.symbol);
}

const COUNTRY_NAMES = new Map<string, string>(
  countries.map((country) => [country.code, country.name]),
);
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });

export function countryName(code: string): string {
  return COUNTRY_NAMES.get(code) ?? REGION_NAMES.of(code) ?? code;
}

function changesOf(inputs: MapInputs, symbol: string): PeriodChanges {
  return inputs.prices[symbol]?.changes ?? NO_CHANGES;
}

/** A dated size scaled by its proxy's move since that date. */
function rollForward(
  inputs: MapInputs,
  usd: number,
  proxy: string,
  date: string,
): number {
  const price = inputs.prices[proxy];
  const ref = price?.refCloses[date];
  return price && ref ? (usd * price.close) / ref : usd;
}

function group(
  id: string,
  label: string,
  children: MapTile[],
  extra?: Partial<MapTile>,
): MapTile {
  const kept = children.filter((child) => child.value > 0);
  return {
    id,
    label,
    value: kept.reduce((sum, child) => sum + child.value, 0),
    changes: weightedChanges(kept),
    children: kept,
    ...extra,
  };
}

function countryEquityTiles(inputs: MapInputs): MapTile[] {
  return COUNTRY_EQUITY.map((row) => {
    const source = SIZE_SOURCES[row.source];
    return {
      id: `equity-${row.country}`,
      label: countryName(row.country),
      value: rollForward(inputs, row.usd, row.proxy, source.asOf),
      changes: changesOf(inputs, row.proxy),
      note: `${source.label} (${source.asOf}), moved with ${row.proxy}`,
    };
  });
}

function buildAssetClasses(inputs: MapInputs): MapView {
  const countryTiles = countryEquityTiles(inputs);
  const sameDate = COUNTRY_EQUITY.map((row, index) => ({
    row,
    tile: countryTiles[index]!,
  })).filter(
    ({ row }) => SIZE_SOURCES[row.source].asOf === SIZE_SOURCES.sifma.asOf,
  );
  const base = sameDate.reduce((sum, { row }) => sum + row.usd, 0);
  const now = sameDate.reduce((sum, { tile }) => sum + tile.value, 0);
  const globalEquity =
    base > 0 ? GLOBAL_EQUITY_USD * (now / base) : GLOBAL_EQUITY_USD;
  const listed = countryTiles.reduce((sum, tile) => sum + tile.value, 0);

  const equities = group("equities", "Equities", [
    ...countryTiles,
    {
      id: "equity-rest",
      label: "Rest of world",
      value: Math.max(0, globalEquity - listed),
      changes: NO_CHANGES,
      note: "Global total (SIFMA) less the markets shown",
    },
  ]);

  const bondShares = BOND_REGION_SHARES.reduce(
    (sum, row) => sum + row.share,
    0,
  );
  const bonds = group(
    "bonds",
    "Bonds",
    [
      ...BOND_REGION_SHARES.map((row) => ({
        id: `bonds-${row.id}`,
        label: row.label,
        value: GLOBAL_BONDS_USD * row.share,
        changes: row.proxy ? changesOf(inputs, row.proxy) : NO_CHANGES,
        note: row.proxy
          ? `Debt securities outstanding; colour from ${row.proxy}`
          : "Debt securities outstanding; no price proxy",
      })),
      {
        id: "bonds-rest",
        label: "Rest of world",
        value: GLOBAL_BONDS_USD * Math.max(0, 1 - bondShares),
        changes: NO_CHANGES,
        note: "Debt securities outstanding; no price proxy",
      },
    ],
    { note: `${SIZE_SOURCES.sifma.label}, end-2025 (not rolled forward)` },
  );

  const goldPrice = inputs.prices.GOLD?.close ?? 0;
  const gold = group(
    "gold",
    "Gold",
    GOLD_STOCK_TONNES.map((row) => ({
      id: `gold-${row.id}`,
      label: row.label,
      value: row.tonnes * TROY_OUNCES_PER_TONNE * goldPrice,
      changes: changesOf(inputs, "GOLD"),
      note: `${row.tonnes.toLocaleString("en")} t × live gold price`,
    })),
  );

  const btc = inputs.prices.BTCUSD?.close ?? 0;
  const eth = inputs.prices.ETHUSD?.close ?? 0;
  const btcSupply = bitcoinSupply(inputs.asOf);
  const crypto = group("crypto", "Crypto", [
    {
      id: "crypto-BTCUSD",
      label: "Bitcoin",
      value: btcSupply * btc,
      changes: changesOf(inputs, "BTCUSD"),
      note: `${(btcSupply / 1e6).toFixed(2)}M BTC mined × price`,
    },
    {
      id: "crypto-ETHUSD",
      label: "Ethereum",
      value: ETH_SUPPLY * eth,
      changes: changesOf(inputs, "ETHUSD"),
      note: `${(ETH_SUPPLY / 1e6).toFixed(2)}M ETH supply × price`,
    },
  ]);

  return {
    id: "asset-classes",
    title: "World wealth by asset class",
    description:
      "Listed stocks, bonds, gold and crypto sized by market value. Equities move with each country's fund; gold and crypto use live prices.",
    unit: "usd",
    tiles: [equities, bonds, gold, crypto].filter((tile) => tile.value > 0),
    sources: [
      "wfe",
      "euronext",
      "worldBank",
      "sifma",
      "wgc",
      "bitcoin",
      "etherscan",
    ],
  };
}

function buildCountries(inputs: MapInputs): MapView {
  const byCountry = new Map(
    countryEquityTiles(inputs).map((tile) => [tile.id.slice(7), tile]),
  );
  const regions = [...new Set(countries.map((country) => country.region))];
  return {
    id: "countries",
    title: "Stock markets by country",
    description:
      "Domestic listed market value per country, grouped by region and moved with each country's fund since the published date.",
    unit: "usd",
    tiles: regions
      .map((region) =>
        group(
          `region-${region}`,
          region,
          countries
            .filter((country) => country.region === region)
            .map((country) => byCountry.get(country.code))
            .filter((tile): tile is MapTile => tile != null),
        ),
      )
      .filter((tile) => tile.value > 0),
    sources: ["wfe", "euronext", "worldBank"],
  };
}

function companyTile(company: MapCompany, snapshot: CompanySnapshot): MapTile {
  return {
    id: `co-${company.symbol}`,
    label: company.symbol,
    name: company.name,
    value: snapshot.marketCapUsd,
    changes: snapshot.changes,
    note: `${company.sector} · close ${snapshot.asOfDate}`,
  };
}

function buildCompanies(inputs: MapInputs): MapView {
  const snapshots = new Map(inputs.companies.map((row) => [row.symbol, row]));
  const listed = companies.filter((company) => snapshots.has(company.symbol));
  const countryCodes = [...new Set(listed.map((company) => company.country))];

  return {
    id: "companies",
    title: "World's largest companies",
    description:
      "Large listed companies by market value in US dollars, grouped by home country and sector. Moves use their US listing or ADR.",
    unit: "usd",
    tiles: countryCodes
      .map((code) => {
        const inCountry = listed.filter((company) => company.country === code);
        const sectors = [
          ...new Set(inCountry.map((company) => company.sector)),
        ];
        return group(
          `country-${code}`,
          countryName(code),
          sectors.map((sector) =>
            group(
              `country-${code}-${sector}`,
              sector,
              inCountry
                .filter((company) => company.sector === sector)
                .map((company) =>
                  companyTile(company, snapshots.get(company.symbol)!),
                ),
            ),
          ),
        );
      })
      .filter((tile) => tile.value > 0),
    sources: [],
  };
}

function buildUsSectors(inputs: MapInputs): MapView {
  const asOf = SIZE_SOURCES.spdji.asOf;
  const rolled = US_SECTOR_WEIGHTS.map((row) => ({
    row,
    value: rollForward(inputs, row.weight, row.proxy, asOf),
  }));
  const total = rolled.reduce((sum, item) => sum + item.value, 0);
  return {
    id: "us-sectors",
    title: "US sectors",
    description:
      "S&P 500 sector weights, moved with each sector fund since the published date.",
    unit: "share",
    tiles: rolled.map(({ row, value }) => ({
      id: `sector-${row.proxy}`,
      label: row.label,
      value: total > 0 ? value / total : 0,
      changes: changesOf(inputs, row.proxy),
      note: `${(row.weight * 100).toFixed(1)}% on ${asOf}, moved with ${row.proxy}`,
    })),
    sources: ["spdji"],
  };
}

function buildMarkets(inputs: MapInputs): MapView {
  return {
    id: "markets",
    title: "Every Tell market",
    description:
      "Each instrument Tell tracks as an equal tile, so colour alone shows what moved.",
    unit: "equal",
    tiles: ASSET_CLASSES.map((cls) => {
      const inClass = assets.filter((asset) => asset.asset_class === cls.id);
      const groups = [...new Set(inClass.map((asset) => asset.asset_group))];
      return group(
        `class-${cls.id}`,
        cls.label,
        groups.map((groupId) =>
          group(
            `class-${cls.id}-${groupId}`,
            ASSET_GROUP_LABELS[groupId] ?? groupId,
            inClass
              .filter((asset) => asset.asset_group === groupId)
              .map((asset) => ({
                id: `mkt-${asset.symbol}`,
                label: asset.symbol,
                name: asset.name,
                value: 1,
                changes: changesOf(inputs, asset.symbol),
              })),
          ),
        ),
      );
    }).filter((tile) => tile.value > 0),
    sources: [],
  };
}

export function buildMapViews(inputs: MapInputs): MapView[] {
  return [
    buildAssetClasses(inputs),
    buildCountries(inputs),
    buildCompanies(inputs),
    buildUsSectors(inputs),
    buildMarkets(inputs),
  ];
}
