import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFinnhubQuote,
  fetchLiveQuote,
  fetchYahooQuote,
  toFinnhubQuoteSymbol,
} from "@/lib/quotes";

afterEach(() => {
  delete process.env.LIVE_MARKET_QUOTES;
});

describe("toFinnhubQuoteSymbol", () => {
  it("skips FX on free tier", () => {
    expect(toFinnhubQuoteSymbol("SPY")).toBe("SPY");
    expect(toFinnhubQuoteSymbol("EURUSD")).toBeNull();
  });
});

describe("fetchFinnhubQuote", () => {
  it("parses quote payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ c: 100, d: 1, dp: 1, pc: 99, t: 1700000000 }),
    });

    const q = await fetchFinnhubQuote("SPY", {
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(q?.price).toBe(100);
    expect(q?.source).toBe("finnhub");
    expect(q?.changePercent).toBeCloseTo(0.01);
  });
});

describe("fetchYahooQuote", () => {
  it("parses chart meta", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 50,
                previousClose: 49,
                regularMarketTime: 1700000000,
              },
            },
          ],
        },
      }),
    });

    const q = await fetchYahooQuote("GLD", "GLD", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(q?.price).toBe(50);
    expect(q?.source).toBe("yahoo");
  });
});

describe("fetchLiveQuote", () => {
  it("skips outbound fetches when LIVE_MARKET_QUOTES is off", async () => {
    process.env.LIVE_MARKET_QUOTES = "false";
    const fetchImpl = vi.fn();
    const q = await fetchLiveQuote("SPY", "SPY", {
      apiKey: "test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(q).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
