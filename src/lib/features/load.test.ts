import { describe, expect, it } from "vitest";
import { listTradingDates } from "@/lib/features/load";
import { buildFeatureSnapshotFromCache } from "@/lib/features";
import type { FeatureSeriesCache } from "@/lib/features";

describe("listTradingDates", () => {
  it("returns ascending dates and respects limit", async () => {
    const rows = [
      { date: "2026-01-02" },
      { date: "2026-01-03" },
      { date: "2026-01-06" },
      { date: "2026-01-07" },
      { date: "2026-01-08" },
    ];

    const db = {
      async execute(query: { sql: string; args?: unknown[] }) {
        const sql = query.sql.replace(/\s+/g, " ").trim();
        const args = query.args ?? [];
        expect(String(args[0])).toBe("SPY");

        if (sql.includes("LIMIT ?")) {
          const limit = Number(args[args.length - 1]);
          const newest = [...rows].reverse().slice(0, limit);
          return {
            rows: newest.sort((a, b) => a.date.localeCompare(b.date)),
          };
        }

        return { rows };
      },
    };

    expect(await listTradingDates(db as never, "SPY", { limit: 3 })).toEqual([
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
    ]);
  });
});

describe("buildFeatureSnapshotFromCache", () => {
  it("scores point-in-time without reloading", () => {
    const cache: FeatureSeriesCache = {
      vixId: "VIX",
      macroSeries: new Map([
        [
          "CPI",
          [
            { date: "2025-01-01", value: 300 },
            { date: "2026-01-01", value: 312 },
          ],
        ],
        ["INDPRO", [{ date: "2026-01-01", value: 100 }]],
        ["FEDFUNDS", [{ date: "2026-01-01", value: 4.3 }]],
        ["T10Y2Y", [{ date: "2026-01-01", value: -0.2 }]],
        ["DGS10", [{ date: "2026-01-01", value: 4.2 }]],
        ["DGS2", [{ date: "2026-01-01", value: 4.4 }]],
        ["VIX", [{ date: "2026-01-08", value: 18 }]],
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
    };

    const snap = buildFeatureSnapshotFromCache(cache, "2026-01-07", ["SPY"]);
    expect(snap.asOf).toBe("2026-01-07");
    expect(snap.markets[0]?.symbol).toBe("SPY");
    expect(snap.regime.asOf).toBe("2026-01-07");
  });
});
