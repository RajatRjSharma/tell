export type AssetBar = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};

export type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    } | null>;
    error?: { description?: string } | null;
  };
};

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

export function unixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

export function dateFromUnixSeconds(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

/** Map Tell / legacy Finnhub symbols onto Yahoo Finance tickers. */
export function toYahooSymbol(sourceSymbol: string): string {
  const map: Record<string, string> = {
    "OANDA:EUR_USD": "EURUSD=X",
    "OANDA:GBP_USD": "GBPUSD=X",
    "OANDA:USD_JPY": "USDJPY=X",
    EURUSD: "EURUSD=X",
    GBPUSD: "GBPUSD=X",
    USDJPY: "USDJPY=X",
  };
  return map[sourceSymbol] ?? sourceSymbol;
}

export function parseYahooChart(payload: YahooChartResponse): AssetBar[] {
  const result = payload.chart?.result?.[0];
  if (!result?.timestamp?.length) return [];

  const quote = result.indicators?.quote?.[0];
  const times = result.timestamp;
  const opens = quote?.open ?? [];
  const highs = quote?.high ?? [];
  const lows = quote?.low ?? [];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];

  const bars: AssetBar[] = [];

  for (let i = 0; i < times.length; i++) {
    const close = closes[i];
    const ts = times[i];
    if (!Number.isFinite(close) || !Number.isFinite(ts)) continue;

    const open = opens[i];
    const high = highs[i];
    const low = lows[i];
    const volume = volumes[i];

    bars.push({
      date: dateFromUnixSeconds(ts),
      open: Number.isFinite(open) ? (open as number) : null,
      high: Number.isFinite(high) ? (high as number) : null,
      low: Number.isFinite(low) ? (low as number) : null,
      close: close as number,
      volume: Number.isFinite(volume) ? (volume as number) : null,
    });
  }

  return bars;
}

export async function fetchYahooDailyBars(
  sourceSymbol: string,
  fromUnix: number,
  toUnix: number,
  options?: {
    fetchImpl?: typeof fetch;
  },
): Promise<AssetBar[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const yahooSymbol = toYahooSymbol(sourceSymbol);
  const url = new URL(`${YAHOO_CHART_BASE}/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("period1", String(fromUnix));
  url.searchParams.set("period2", String(toUnix));
  url.searchParams.set("events", "history");

  const res = await fetchImpl(url.toString(), {
    headers: {
      "User-Agent": "TellMacroBot/0.1 (research; local ingest)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo HTTP ${res.status} for ${yahooSymbol}`);
  }

  const data = (await res.json()) as YahooChartResponse;
  if (data.chart?.error?.description) {
    throw new Error(
      `Yahoo error for ${yahooSymbol}: ${data.chart.error.description}`,
    );
  }

  return parseYahooChart(data);
}
