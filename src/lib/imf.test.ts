import { describe, expect, it, vi } from "vitest";
import {
  fetchImfCountryReadings,
  parseImfIndicatorValues,
  yearToObservedFor,
} from "@/lib/imf";

describe("yearToObservedFor", () => {
  it("maps a year to Jan 1 ISO date", () => {
    expect(yearToObservedFor(2020)).toBe("2020-01-01");
    expect(yearToObservedFor("2019")).toBe("2019-01-01");
  });
});

describe("parseImfIndicatorValues", () => {
  it("extracts readings for requested countries and filters years", () => {
    const parsed = parseImfIndicatorValues(
      "NGDP_RPCH",
      {
        values: {
          NGDP_RPCH: {
            IND: { "2014": 7.4, "2015": 8.0, "2020": -5.8 },
            DEU: { "2015": 1.5, "2020": -3.8 },
            USA: { "2015": 2.7 },
          },
        },
      },
      ["IN", "DE"],
      { minYear: 2015, maxYear: 2025 },
    );

    expect(parsed.IN).toEqual([
      { observedFor: "2015-01-01", value: 8.0 },
      { observedFor: "2020-01-01", value: -5.8 },
    ]);
    expect(parsed.DE).toEqual([
      { observedFor: "2015-01-01", value: 1.5 },
      { observedFor: "2020-01-01", value: -3.8 },
    ]);
    expect(parsed.US).toBeUndefined();
  });
});

describe("fetchImfCountryReadings", () => {
  it("fetches and parses IMF DataMapper payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: {
          PCPIPCH: {
            GBR: { "2015": 0.4, "2016": 1.0 },
          },
        },
      }),
    });

    const byCountry = await fetchImfCountryReadings("PCPIPCH", ["GB"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minYear: 2015,
    });

    expect(byCountry.GB).toEqual([
      { observedFor: "2015-01-01", value: 0.4 },
      { observedFor: "2016-01-01", value: 1.0 },
    ]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/PCPIPCH");
  });
});
