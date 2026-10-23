import { resilientFetch } from "@/lib/http/fetch-retry";
import type { AssetBar } from "@/lib/yahoo";

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

/**
 * Tell FX symbol → ECB reference currency quoted against USD, and whether our
 * pair is USD-per-unit (EURUSD) or units-per-USD (USDJPY).
 */
export const ECB_FX_PAIRS: Record<
  string,
  { currency: string; invert: boolean }
> = {
  EURUSD: { currency: "EUR", invert: true },
  GBPUSD: { currency: "GBP", invert: true },
  USDJPY: { currency: "JPY", invert: false },
  USDCNY: { currency: "CNY", invert: false },
};

export type FrankfurterSeries = {
  base?: string;
  rates?: Record<string, Record<string, number>>;
};

/** Daily close-only bars for one Tell FX symbol from a USD-based series. */
export function parseEcbFxBars(
  symbol: string,
  payload: FrankfurterSeries,
): AssetBar[] {
  const pair = ECB_FX_PAIRS[symbol];
  if (!pair || payload.base !== "USD") return [];

  const bars: AssetBar[] = [];
  for (const [date, rates] of Object.entries(payload.rates ?? {})) {
    const raw = rates[pair.currency];
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    const close = pair.invert ? 1 / raw : raw;
    bars.push({
      date,
      open: null,
      high: null,
      low: null,
      close: Number(close.toFixed(6)),
      volume: null,
    });
  }
  return bars.sort((a, b) => a.date.localeCompare(b.date));
}

/** ECB euro foreign exchange reference rates via Frankfurter (no key). */
export async function fetchEcbFxBars(
  symbol: string,
  startDate: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<AssetBar[]> {
  const pair = ECB_FX_PAIRS[symbol];
  if (!pair) return [];
  const fetchImpl = options?.fetchImpl ?? resilientFetch;
  const url = `${FRANKFURTER_BASE}/${startDate}..?base=USD&symbols=${pair.currency}`;

  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Frankfurter HTTP ${res.status} for ${symbol}`);
  }
  return parseEcbFxBars(symbol, (await res.json()) as FrankfurterSeries);
}
