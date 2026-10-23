import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearQuoteCache,
  fetchFinnhubQuote,
  fetchLiveQuote,
  QUOTE_TTL_MS,
  toFinnhubQuoteSymbol,
} from "@/lib/quotes";

// Wed 2026-10-21 14:00 ET (18:00 UTC) and Sat 2026-10-24 14:00 ET.
const OPEN = Date.parse("2026-10-21T18:00:00Z");
const WEEKEND = Date.parse("2026-10-24T18:00:00Z");

function finnhubOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ c: 100, d: 1, dp: 1, pc: 99, t: 1700000000 }),
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

beforeEach(() => clearQuoteCache());
afterEach(() => {
  delete process.env.LIVE_MARKET_QUOTES;
});

describe("toFinnhubQuoteSymbol", () => {
  it("skips every FX instrument by asset class", () => {
    expect(toFinnhubQuoteSymbol("SPY", "equity")).toBe("SPY");
    expect(toFinnhubQuoteSymbol("EURUSD", "fx")).toBeNull();
    expect(toFinnhubQuoteSymbol("USDCNY", "fx")).toBeNull();
  });
});

describe("fetchFinnhubQuote", () => {
  it("parses quote payload", async () => {
    const q = await fetchFinnhubQuote("SPY", {
      apiKey: "test",
      fetchImpl: finnhubOk(),
    });

    expect(q?.price).toBe(100);
    expect(q?.source).toBe("finnhub");
    expect(q?.changePercent).toBeCloseTo(0.01);
  });
});

describe("fetchLiveQuote", () => {
  it("skips outbound fetches when LIVE_MARKET_QUOTES is off", async () => {
    process.env.LIVE_MARKET_QUOTES = "false";
    const fetchImpl = finnhubOk();
    const result = await fetchLiveQuote("SPY", {
      apiKey: "test",
      fetchImpl,
      now: () => OPEN,
    });
    expect(result).toEqual({ quote: null, status: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call the provider outside the US session", async () => {
    const fetchImpl = finnhubOk();
    const result = await fetchLiveQuote("SPY", {
      apiKey: "test",
      fetchImpl,
      now: () => WEEKEND,
    });
    expect(result.status).toBe("closed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("marks FX as unsupported without a provider call", async () => {
    const fetchImpl = finnhubOk();
    const result = await fetchLiveQuote("USDCNY", {
      assetClass: "fx",
      apiKey: "test",
      fetchImpl,
      now: () => OPEN,
    });
    expect(result.status).toBe("unsupported");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("shares one provider call per symbol within the TTL", async () => {
    const fetchImpl = finnhubOk();
    let clock = OPEN;
    const options = {
      assetClass: "equity",
      apiKey: "test",
      fetchImpl,
      now: () => clock,
    };

    const [a, b] = await Promise.all([
      fetchLiveQuote("SPY", options),
      fetchLiveQuote("SPY", options),
    ]);
    expect(a.status).toBe("live");
    expect(b.quote?.price).toBe(100);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += QUOTE_TTL_MS - 1;
    await fetchLiveQuote("SPY", options);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += 2;
    await fetchLiveQuote("SPY", options);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports provider failures as unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error("down")) as unknown as typeof fetch;
    const result = await fetchLiveQuote("SPY", {
      apiKey: "test",
      fetchImpl,
      now: () => OPEN,
    });
    expect(result).toEqual({ quote: null, status: "unavailable" });
  });
});
