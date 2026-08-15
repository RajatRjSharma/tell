import { describe, expect, it } from "vitest";
import {
  buildImpactRows,
  collectForwardReturns,
  filterEventsForStudy,
  median,
  primarySourceForSymbol,
  sourcesForSymbol,
  summarizeReturnSample,
} from "@/lib/events/impact";
import type { PolicyEvent } from "@/lib/events/store";

function event(overrides?: Partial<PolicyEvent>): PolicyEvent {
  return {
    id: "fed:1",
    date: "2026-01-10",
    countryCode: "US",
    type: "policy",
    title: "FOMC statement",
    summary: null,
    url: null,
    sentiment: 0.35,
    assetsImpact: ["SPY"],
    source: "Fed",
    createdAt: "2026-01-10T00:00:00Z",
    ...overrides,
  };
}

describe("impact helpers", () => {
  it("maps symbols to policy sources", () => {
    expect(primarySourceForSymbol("SPY")).toBe("Fed");
    expect(sourcesForSymbol("TLT")).toEqual(
      expect.arrayContaining(["Fed", "ECB", "BoE"]),
    );
  });

  it("summarizes return samples", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    const stats = summarizeReturnSample([0.01, -0.02, 0.03]);
    expect(stats.n).toBe(3);
    expect(stats.hitRateUp).toBeCloseTo(2 / 3);
    expect(stats.mean).toBeCloseTo(0.006666, 5);
  });

  it("filters by sentiment bucket", () => {
    const events = [
      event({ id: "a", sentiment: 0.4 }),
      event({ id: "b", sentiment: -0.4, date: "2026-02-01" }),
      event({ id: "c", sentiment: null, date: "2026-03-01" }),
    ];
    expect(
      filterEventsForStudy(events, { sentimentFilter: "hawkish" }),
    ).toHaveLength(1);
    expect(
      filterEventsForStudy(events, { sentimentFilter: "dovish" }),
    ).toHaveLength(1);
    expect(
      filterEventsForStudy(events, { sentimentFilter: "any" }),
    ).toHaveLength(3);
  });

  it("collects forward returns after event dates", () => {
    const closes = [
      { date: "2026-01-09", value: 100 },
      { date: "2026-01-10", value: 100 },
      { date: "2026-01-13", value: 102 },
      { date: "2026-01-14", value: 101 },
    ];
    expect(collectForwardReturns(closes, ["2026-01-10"], "1d")).toEqual([0.02]);
  });

  it("builds asset × horizon rows", () => {
    const closes = new Map([
      [
        "SPY",
        [
          { date: "2026-01-09", value: 100 },
          { date: "2026-01-10", value: 100 },
          { date: "2026-01-13", value: 103 },
        ],
      ],
    ]);
    const rows = buildImpactRows(["2026-01-10"], closes, ["SPY"], ["1d"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stats.n).toBe(1);
    expect(rows[0]?.stats.median).toBeCloseTo(0.03);
  });
});
