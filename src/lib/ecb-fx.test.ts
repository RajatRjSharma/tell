import { describe, expect, it } from "vitest";
import { parseEcbFxBars } from "@/lib/ecb-fx";

const PAYLOAD = {
  base: "USD",
  rates: {
    "2026-10-22": { EUR: 0.8, JPY: 157.05 },
    "2026-10-21": { EUR: 0.9, JPY: 156.5 },
  },
};

describe("parseEcbFxBars", () => {
  it("inverts USD-per-unit pairs and sorts by date", () => {
    expect(parseEcbFxBars("EURUSD", PAYLOAD).map((bar) => bar.close)).toEqual([
      1.111111, 1.25,
    ]);
  });

  it("keeps units-per-USD pairs as quoted, close only", () => {
    const bars = parseEcbFxBars("USDJPY", PAYLOAD);
    expect(bars[1]).toEqual({
      date: "2026-10-22",
      open: null,
      high: null,
      low: null,
      close: 157.05,
      volume: null,
    });
  });

  it("ignores unknown symbols and non-USD bases", () => {
    expect(parseEcbFxBars("SPY", PAYLOAD)).toEqual([]);
    expect(parseEcbFxBars("EURUSD", { ...PAYLOAD, base: "EUR" })).toEqual([]);
  });
});
