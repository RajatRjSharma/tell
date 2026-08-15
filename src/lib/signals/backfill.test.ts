import { describe, expect, it, vi } from "vitest";
import { backfillHistoricalSignals } from "@/lib/signals/backfill";

vi.mock("@/lib/features", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/features")>("@/lib/features");
  return {
    ...actual,
    listTradingDates: vi.fn(async () => ["2026-01-07", "2026-01-08"]),
    preloadFeatureSeries: vi.fn(async () => ({
      vixId: "VIX",
      macroSeries: new Map([
        ["CPI", [{ date: "2026-01-01", value: 310 }]],
        ["INDPRO", [{ date: "2026-01-01", value: 100 }]],
        ["FEDFUNDS", [{ date: "2026-01-01", value: 4.3 }]],
        ["T10Y2Y", [{ date: "2026-01-01", value: 0.1 }]],
        ["DGS10", [{ date: "2026-01-01", value: 4.2 }]],
        ["DGS2", [{ date: "2026-01-01", value: 4.1 }]],
        ["VIX", [{ date: "2026-01-08", value: 16 }]],
      ]),
      marketCloses: new Map([
        [
          "SPY",
          [
            { date: "2026-01-06", value: 100 },
            { date: "2026-01-07", value: 101 },
            { date: "2026-01-08", value: 102 },
          ],
        ],
      ]),
    })),
  };
});

vi.mock("@/lib/signals/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/signals/store")>(
    "@/lib/signals/store",
  );
  return {
    ...actual,
    upsertSignals: vi.fn(async (_db: unknown, rows: unknown[]) => rows.length),
  };
});

describe("backfillHistoricalSignals", () => {
  it("writes signals for each trading day", async () => {
    const result = await backfillHistoricalSignals({} as never, {
      symbols: ["SPY"],
      horizons: ["1d"],
      days: 2,
    });

    expect(result.dates).toEqual(["2026-01-07", "2026-01-08"]);
    expect(result.signalsPerDay).toBe(1);
    expect(result.written).toBe(2);
  });
});
