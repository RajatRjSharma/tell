import { liveMarketQuotesEnabled } from "@/lib/config";
import { isUsMarketOpen } from "@/lib/market-hours";

export type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  asOfUnix: number | null;
  source: "finnhub";
};

/**
 * Why a quote is or isn't present:
 * - `live`: fresh provider quote (cached up to `QUOTE_TTL_MS`)
 * - `closed`: US session closed, no provider call made
 * - `unsupported`: instrument has no licensed live feed (FX on Finnhub free)
 * - `disabled`: `LIVE_MARKET_QUOTES=false` or no `FINNHUB_API_KEY`
 * - `unavailable`: provider call failed or returned no price
 */
export type QuoteStatus =
  "live" | "closed" | "unsupported" | "disabled" | "unavailable";

export type LiveQuoteResult = { quote: Quote | null; status: QuoteStatus };

export const QUOTE_TTL_MS = 60_000;

/** Finnhub free tier serves US-listed stocks/ETFs; FX quotes need a paid plan. */
export function toFinnhubQuoteSymbol(
  symbol: string,
  assetClass?: string | null,
): string | null {
  if (assetClass === "fx") return null;
  return symbol;
}

export async function fetchFinnhubQuote(
  symbol: string,
  options?: { apiKey?: string; fetchImpl?: typeof fetch },
): Promise<Quote | null> {
  const apiKey = options?.apiKey ?? process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", apiKey);

  const res = await fetchImpl(url, { signal: AbortSignal.timeout(5_000) });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    c?: number;
    d?: number;
    dp?: number;
    pc?: number;
    t?: number;
  };

  if (!Number.isFinite(data.c) || data.c === 0) return null;

  return {
    symbol,
    price: data.c!,
    change: Number.isFinite(data.d) ? data.d! : null,
    changePercent: Number.isFinite(data.dp) ? data.dp! / 100 : null,
    previousClose: Number.isFinite(data.pc) ? data.pc! : null,
    asOfUnix: Number.isFinite(data.t) ? data.t! : null,
    source: "finnhub",
  };
}

type CacheEntry = { at: number; result: LiveQuoteResult };

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<LiveQuoteResult>>();

export function clearQuoteCache(): void {
  cache.clear();
  inflight.clear();
}

/**
 * Live quote for one instrument, shared across users: at most one provider
 * call per symbol per minute, and none outside the US session.
 */
export async function fetchLiveQuote(
  tellSymbol: string,
  options?: {
    assetClass?: string | null;
    apiKey?: string;
    fetchImpl?: typeof fetch;
    now?: () => number;
  },
): Promise<LiveQuoteResult> {
  const apiKey = options?.apiKey ?? process.env.FINNHUB_API_KEY;
  if (!liveMarketQuotesEnabled() || !apiKey) {
    return { quote: null, status: "disabled" };
  }

  const finnhubSymbol = toFinnhubQuoteSymbol(tellSymbol, options?.assetClass);
  if (!finnhubSymbol) return { quote: null, status: "unsupported" };

  const now = options?.now ?? Date.now;
  if (!isUsMarketOpen(new Date(now()))) {
    return { quote: null, status: "closed" };
  }

  const cached = cache.get(finnhubSymbol);
  if (cached && now() - cached.at < QUOTE_TTL_MS) return cached.result;

  const pending = inflight.get(finnhubSymbol);
  if (pending) return pending;

  const request = fetchFinnhubQuote(finnhubSymbol, {
    apiKey,
    fetchImpl: options?.fetchImpl,
  })
    .then((quote): LiveQuoteResult => {
      const result: LiveQuoteResult = quote
        ? { quote: { ...quote, symbol: tellSymbol }, status: "live" }
        : { quote: null, status: "unavailable" };
      cache.set(finnhubSymbol, { at: now(), result });
      return result;
    })
    .catch((): LiveQuoteResult => ({ quote: null, status: "unavailable" }))
    .finally(() => inflight.delete(finnhubSymbol));

  inflight.set(finnhubSymbol, request);
  return request;
}
