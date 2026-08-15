import { describe, expect, it, vi } from "vitest";
import {
  parseWorldBankObservations,
  fetchWorldBankIndicator,
  worldBankIdForImf,
} from "@/lib/worldbank";

describe("worldBankIdForImf", () => {
  it("maps WEO codes to World Bank indicators", () => {
    expect(worldBankIdForImf("NGDP_RPCH")).toBe("NY.GDP.MKTP.KD.ZG");
    expect(worldBankIdForImf("UNKNOWN")).toBeUndefined();
  });
});

describe("parseWorldBankObservations", () => {
  it("groups by ISO-2 and filters years", () => {
    const parsed = parseWorldBankObservations(
      [
        { country: { id: "IN" }, date: "2014", value: 7.4 },
        { country: { id: "IN" }, date: "2015", value: 8.0 },
        { country: { id: "DE" }, date: "2020", value: -3.8 },
        { country: { id: "US" }, date: "2015", value: null },
      ],
      ["IN", "DE", "US"],
      { minYear: 2015, maxYear: 2025 },
    );

    expect(parsed.IN).toEqual([{ observedFor: "2015-01-01", value: 8.0 }]);
    expect(parsed.DE).toEqual([{ observedFor: "2020-01-01", value: -3.8 }]);
    expect(parsed.US).toEqual([]);
  });
});

describe("fetchWorldBankIndicator", () => {
  it("calls World Bank API and parses rows", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { page: 1 },
        [{ country: { id: "GB" }, date: "2016", value: 1.0 }],
      ],
    });

    const byCountry = await fetchWorldBankIndicator("FP.CPI.TOTL.ZG", ["GB"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minYear: 2015,
    });

    expect(byCountry.GB).toEqual([{ observedFor: "2016-01-01", value: 1.0 }]);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "indicator/FP.CPI.TOTL.ZG",
    );
  });
});
