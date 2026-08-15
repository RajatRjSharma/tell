import { describe, expect, it } from "vitest";
import { parseLimit, parseOptionalDate } from "@/lib/api/http";
import { groupOutlookBySymbol, type OutlookSignalDto } from "@/lib/api/outlook";

describe("parseLimit", () => {
  it("clamps and falls back", () => {
    expect(parseLimit(null, 120, 2000)).toBe(120);
    expect(parseLimit("50", 120, 2000)).toBe(50);
    expect(parseLimit("99999", 120, 2000)).toBe(2000);
    expect(parseLimit("nope", 120, 2000)).toBe(120);
  });
});

describe("parseOptionalDate", () => {
  it("accepts ISO dates only", () => {
    expect(parseOptionalDate("2024-06-01")).toBe("2024-06-01");
    expect(parseOptionalDate("06/01/2024")).toBeNull();
    expect(parseOptionalDate("")).toBeNull();
  });
});

describe("groupOutlookBySymbol", () => {
  it("groups rows", () => {
    const rows: OutlookSignalDto[] = [
      {
        symbol: "SPY",
        horizon: "1d",
        asOfDate: "2024-01-01",
        score: 0.1,
        direction: "bullish",
        confidence: 0.5,
        drivers: [],
        regime: "expansion",
        modelVersion: "rules-v1",
      },
      {
        symbol: "SPY",
        horizon: "1w",
        asOfDate: "2024-01-01",
        score: 0.2,
        direction: "bullish",
        confidence: 0.5,
        drivers: [],
        regime: "expansion",
        modelVersion: "rules-v1",
      },
      {
        symbol: "TLT",
        horizon: "1d",
        asOfDate: "2024-01-01",
        score: -0.2,
        direction: "bearish",
        confidence: 0.5,
        drivers: [],
        regime: "inflationary",
        modelVersion: "rules-v1",
      },
    ];

    const grouped = groupOutlookBySymbol(rows);
    expect(Object.keys(grouped)).toEqual(["SPY", "TLT"]);
    expect(grouped.SPY).toHaveLength(2);
  });
});
