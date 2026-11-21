import { describe, expect, it, vi } from "vitest";
import {
  dateFromUnixSeconds,
  fetchYahooDailyBars,
  isWeekday,
  parseYahooChart,
  toYahooSymbol,
} from "@/lib/yahoo";

describe("dateFromUnixSeconds", () => {
  it("formats UTC date", () => {
    expect(dateFromUnixSeconds(1704067200)).toBe("2024-01-01");
  });
});

describe("toYahooSymbol", () => {
  it("maps FX pairs and passes through ETFs", () => {
    expect(toYahooSymbol("OANDA:EUR_USD")).toBe("EURUSD=X");
    expect(toYahooSymbol("EURUSD")).toBe("EURUSD=X");
    expect(toYahooSymbol("SPY")).toBe("SPY");
  });
});

describe("parseYahooChart", () => {
  it("maps quote arrays into bars and skips null closes", () => {
    const bars = parseYahooChart({
      chart: {
        result: [
          {
            timestamp: [1704067200, 1704153600],
            indicators: {
              quote: [
                {
                  open: [100, 101],
                  high: [102, 103],
                  low: [99, 100],
                  close: [101, null],
                  volume: [1000, 1100],
                },
              ],
            },
          },
        ],
      },
    });

    expect(bars).toEqual([
      {
        date: "2024-01-01",
        open: 100,
        high: 102,
        low: 99,
        close: 101,
        volume: 1000,
      },
    ]);
  });

  it("drops weekend bars so every instrument shares a weekday calendar", () => {
    // Fri 2024-01-05, Sat 2024-01-06, Sun 2024-01-07, Mon 2024-01-08
    const bars = parseYahooChart({
      chart: {
        result: [
          {
            timestamp: [1704412800, 1704499200, 1704585600, 1704672000],
            indicators: {
              quote: [
                {
                  open: [1, 2, 3, 4],
                  high: [1, 2, 3, 4],
                  low: [1, 2, 3, 4],
                  close: [1, 2, 3, 4],
                  volume: [null, null, null, null],
                },
              ],
            },
          },
        ],
      },
    });

    expect(bars.map((bar) => [bar.date, bar.close])).toEqual([
      ["2024-01-05", 1],
      ["2024-01-08", 4],
    ]);
  });
});

describe("isWeekday", () => {
  it("treats Saturday and Sunday as closed", () => {
    expect(isWeekday("2024-01-05")).toBe(true);
    expect(isWeekday("2024-01-06")).toBe(false);
    expect(isWeekday("2024-01-07")).toBe(false);
  });
});

describe("fetchYahooDailyBars", () => {
  it("calls Yahoo chart endpoint", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        chart: {
          result: [
            {
              timestamp: [1704067200],
              indicators: {
                quote: [
                  {
                    open: [10],
                    high: [11],
                    low: [9],
                    close: [10.5],
                    volume: [500],
                  },
                ],
              },
            },
          ],
        },
      }),
    });

    const bars = await fetchYahooDailyBars("SPY", 1, 2, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(bars).toHaveLength(1);
    expect(bars[0]?.close).toBe(10.5);
    const calledUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("/chart/SPY");
    expect(calledUrl).toContain("interval=1d");
  });
});
