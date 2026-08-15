export type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  asOfUnix: number | null;
  source: "finnhub" | "yahoo";
};

/** Finnhub symbol mapping (equities/ETFs on free tier). */
export function toFinnhubQuoteSymbol(symbol: string): string | null {
  const fx = new Set(["EURUSD", "GBPUSD", "USDJPY"]);
  if (fx.has(symbol)) return null; // free candle/FX quote often blocked
  return symbol;
}

export async function fetchFinnhubQuote(
  symbol: string,
  options?: { apiKey?: string; fetchImpl?: typeof fetch },
): Promise<Quote | null> {
  const apiKey = options?.apiKey ?? process.env.FINNHUB_API_KEY;
  if (!apiKey) return null;

  const fhSymbol = toFinnhubQuoteSymbol(symbol);
  if (!fhSymbol) return null;

  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", fhSymbol);
  url.searchParams.set("token", apiKey);

  const res = await fetchImpl(url);
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

/** Yahoo quote fallback when Finnhub isn't available. */
export async function fetchYahooQuote(
  yahooSymbol: string,
  tellSymbol: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<Quote | null> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "5d");

  const res = await fetchImpl(url.toString(), {
    headers: {
      "User-Agent": "TellMacroBot/0.1 (research; quote)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          regularMarketTime?: number;
        };
      }>;
    };
  };

  const meta = data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (!Number.isFinite(price)) return null;

  const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
  const change =
    previousClose != null && Number.isFinite(previousClose)
      ? price! - previousClose
      : null;
  const changePercent =
    change != null && previousClose ? change / previousClose : null;

  return {
    symbol: tellSymbol,
    price: price!,
    change,
    changePercent,
    previousClose,
    asOfUnix: meta?.regularMarketTime ?? null,
    source: "yahoo",
  };
}

export async function fetchLiveQuote(
  tellSymbol: string,
  yahooSymbol: string,
  options?: { fetchImpl?: typeof fetch; apiKey?: string },
): Promise<Quote | null> {
  if (process.env.TEST_MODE === "1") return null;

  const fh = await fetchFinnhubQuote(tellSymbol, options);
  if (fh) return fh;
  return fetchYahooQuote(yahooSymbol, tellSymbol, options);
}
