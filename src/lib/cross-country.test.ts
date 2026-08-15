import { describe, expect, it, vi } from "vitest";
import { fetchCrossCountryReadings } from "@/lib/cross-country";

describe("fetchCrossCountryReadings", () => {
  it("returns IMF data when DataMapper succeeds", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        values: {
          NGDP_RPCH: {
            USA: { "2015": 2.7 },
          },
        },
      }),
    });

    const result = await fetchCrossCountryReadings("NGDP_RPCH", ["US"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minYear: 2015,
    });

    expect(result.source).toBe("IMF");
    expect(result.byCountry.US).toEqual([
      { observedFor: "2015-01-01", value: 2.7 },
    ]);
  });

  it("falls back to World Bank when IMF returns 403", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { page: 1 },
          [{ country: { id: "US" }, date: "2015", value: 2.9 }],
        ],
      });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await fetchCrossCountryReadings("NGDP_RPCH", ["US"], {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minYear: 2015,
    });

    expect(result.source).toBe("WorldBank");
    expect(result.byCountry.US).toEqual([
      { observedFor: "2015-01-01", value: 2.9 },
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
