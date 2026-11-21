/**
 * Published market sizes behind the market map. Each figure keeps its source
 * and date; the map rolls dated figures forward with a price proxy so a size
 * moves with the market instead of freezing at year end.
 */
export type SizeSource = { label: string; url: string; asOf: string };

export const SIZE_SOURCES = {
  wfe: {
    label: "World Federation of Exchanges, domestic market capitalisation",
    url: "https://focus.world-exchanges.org/issue/february-2026/market-statistics",
    asOf: "2025-12-31",
  },
  euronext: {
    label: "Euronext Paris aggregated market capitalisation (€3.111tn)",
    url: "https://www.euronext.com/en/media/15109/download",
    asOf: "2025-12-31",
  },
  worldBank: {
    label: "World Bank, market capitalisation of listed companies",
    url: "https://data.worldbank.org/indicator/CM.MKT.LCAP.CD",
    asOf: "2022-12-30",
  },
  sifma: {
    label: "SIFMA Capital Markets Fact Book 2026",
    url: "https://www.sifma.org/research/statistics/fact-book",
    asOf: "2025-12-31",
  },
  wgc: {
    label: "World Gold Council, above-ground stocks",
    url: "https://www.gold.org/goldhub/data/how-much-gold",
    asOf: "2026-09-30",
  },
  bitcoin: {
    label: "Bitcoin issuance schedule (3.125 BTC per block since April 2024)",
    url: "https://en.bitcoin.it/wiki/Controlled_supply",
    asOf: "2024-04-20",
  },
  etherscan: {
    label: "Etherscan, total Ether supply",
    url: "https://etherscan.io/stat/supply",
    asOf: "2026-11-21",
  },
  spdji: {
    label: "S&P Dow Jones Indices, S&P 500 sector weights",
    url: "https://www.spglobal.com/spdji/en/indices/equity/sp-500/",
    asOf: "2026-10-30",
  },
} satisfies Record<string, SizeSource>;

export type SizeSourceId = keyof typeof SIZE_SOURCES;

/**
 * Domestic equity market capitalisation by country, in USD, rolled forward
 * with the country fund. US = NYSE + Nasdaq; China = Shanghai + Shenzhen
 * (Hong Kong falls in "rest of world"); France converts €3.111tn at the
 * 2025-12-31 EUR/USD close of 1.1747. London stopped reporting to the WFE,
 * so the UK uses the World Bank's last figure.
 */
export const COUNTRY_EQUITY: ReadonlyArray<{
  country: string;
  proxy: string;
  usd: number;
  source: SizeSourceId;
}> = [
  { country: "US", proxy: "SPY", usd: 67_396.53e9, source: "wfe" },
  { country: "CA", proxy: "EWC", usd: 4_553.47e9, source: "wfe" },
  { country: "BR", proxy: "EWZ", usd: 901.23e9, source: "wfe" },
  { country: "GB", proxy: "EWU", usd: 3_095.98e9, source: "worldBank" },
  { country: "DE", proxy: "EWG", usd: 3_002.74e9, source: "wfe" },
  { country: "FR", proxy: "EWQ", usd: 3_654.5e9, source: "euronext" },
  { country: "CH", proxy: "EWL", usd: 2_515.51e9, source: "wfe" },
  { country: "IN", proxy: "INDA", usd: 5_269.89e9, source: "wfe" },
  { country: "CN", proxy: "MCHI", usd: 15_278.01e9, source: "wfe" },
  { country: "JP", proxy: "EWJ", usd: 7_784.86e9, source: "wfe" },
  { country: "KR", proxy: "EWY", usd: 2_669.95e9, source: "wfe" },
  { country: "TW", proxy: "EWT", usd: 3_003.15e9, source: "wfe" },
  { country: "AU", proxy: "EWA", usd: 2_086.62e9, source: "wfe" },
];

/** Global equity market cap, rolled forward with the country markets above. */
export const GLOBAL_EQUITY_USD = 157.8e12;

/** Global debt securities outstanding (SIFMA from BIS), shares by issuer. */
export const GLOBAL_BONDS_USD = 160.7e12;
export const BOND_REGION_SHARES: ReadonlyArray<{
  id: string;
  label: string;
  share: number;
  proxy?: string;
}> = [
  { id: "US", label: "United States", share: 0.381, proxy: "IEF" },
  { id: "EU", label: "European Union", share: 0.194 },
  { id: "CN", label: "China", share: 0.179 },
  { id: "JP", label: "Japan", share: 0.067 },
  { id: "CA", label: "Canada", share: 0.043 },
  { id: "GB", label: "United Kingdom", share: 0.029 },
];

export const TROY_OUNCES_PER_TONNE = 32_150.7466;

/** Above-ground gold by holder, tonnes (WGC, end-Q3 2026). */
export const GOLD_STOCK_TONNES: ReadonlyArray<{
  id: string;
  label: string;
  tonnes: number;
}> = [
  { id: "jewellery", label: "Jewellery", tonnes: 98_700 },
  { id: "bars_coins", label: "Bars and coins", tonnes: 48_100 },
  { id: "central_banks", label: "Central banks", tonnes: 39_300 },
  { id: "otc_other", label: "OTC and industrial", tonnes: 33_800 },
  { id: "etfs", label: "Gold ETFs", tonnes: 4_300 },
];

const BTC_HALVING_2024 = Date.UTC(2024, 3, 20);
const BTC_SUPPLY_AT_HALVING_2024 = 19_687_500;
const BTC_PER_DAY = 3.125 * 144;
const BTC_MAX_SUPPLY = 21_000_000;

/** Mined bitcoin on a date, from the issuance schedule (±0.1% block-time drift). */
export function bitcoinSupply(date: string): number {
  const days =
    (Date.parse(`${date}T00:00:00Z`) - BTC_HALVING_2024) / 86_400_000;
  if (!Number.isFinite(days)) return BTC_SUPPLY_AT_HALVING_2024;
  return Math.min(
    BTC_MAX_SUPPLY,
    BTC_SUPPLY_AT_HALVING_2024 + Math.max(0, days) * BTC_PER_DAY,
  );
}

export const ETH_SUPPLY = 122.24e6;

/** S&P 500 weight per sector fund, rolled forward with each fund. */
export const US_SECTOR_WEIGHTS: ReadonlyArray<{
  proxy: string;
  label: string;
  weight: number;
}> = [
  { proxy: "XLK", label: "Information Technology", weight: 0.374 },
  { proxy: "XLF", label: "Financials", weight: 0.122 },
  { proxy: "XLV", label: "Health Care", weight: 0.103 },
  { proxy: "XLY", label: "Consumer Discretionary", weight: 0.09 },
  { proxy: "XLC", label: "Communication Services", weight: 0.084 },
  { proxy: "XLI", label: "Industrials", weight: 0.081 },
  { proxy: "XLP", label: "Consumer Staples", weight: 0.05 },
  { proxy: "XLE", label: "Energy", weight: 0.039 },
  { proxy: "XLU", label: "Utilities", weight: 0.021 },
  { proxy: "XLRE", label: "Real Estate", weight: 0.018 },
  { proxy: "XLB", label: "Materials", weight: 0.017 },
];
