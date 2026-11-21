export type AssetClassId =
  "equity" | "fx" | "commodity" | "rates" | "credit" | "cash" | "crypto";

export const ASSET_CLASSES: ReadonlyArray<{ id: AssetClassId; label: string }> =
  [
    { id: "equity", label: "Equity" },
    { id: "fx", label: "Currency" },
    { id: "commodity", label: "Commodity" },
    { id: "rates", label: "Rates" },
    { id: "credit", label: "Credit" },
    { id: "cash", label: "Cash" },
    { id: "crypto", label: "Crypto" },
  ];

export const ASSET_GROUP_LABELS: Record<string, string> = {
  country: "Country stock market",
  us_sector: "US sector",
  dollar_index: "Dollar index",
  major: "Major currency",
  emerging: "Emerging-market currency",
  precious: "Precious metal",
  industrial: "Industrial metal",
  energy: "Energy",
  agriculture: "Agriculture",
  crypto: "Crypto",
  tbills: "T-bills",
  treasury: "Government bonds",
  investment_grade: "Investment-grade credit",
  high_yield: "High-yield credit",
  emerging_debt: "Emerging-market debt",
};

/**
 * T-bills barely move and carry no directional view, so they are tracked
 * for prices and flows but not scored.
 */
export const UNSCORED_CLASSES: ReadonlySet<string> = new Set(["cash"]);

export function isScoredClass(assetClass: string): boolean {
  return !UNSCORED_CLASSES.has(assetClass);
}

/**
 * +1 when the pair rises as the US dollar strengthens (DXY, USD/JPY),
 * −1 when it falls (EUR/USD), 0 when the symbol is not a USD pair.
 */
export function usdOrientation(symbol: string): -1 | 0 | 1 {
  if (symbol === "DXY" || symbol.startsWith("USD")) return 1;
  if (symbol.endsWith("USD")) return -1;
  return 0;
}

/** Currencies that tend to strengthen even against the dollar in a crisis. */
export const SAFE_HAVEN_PAIRS: ReadonlySet<string> = new Set([
  "USDJPY",
  "USDCHF",
]);
