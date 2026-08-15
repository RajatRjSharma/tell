import { describe, expect, it, vi } from "vitest";
import { fetchFredSeriesObservations, parseFredObservations } from "@/lib/fred";

describe("parseFredObservations", () => {
  it("keeps numeric values and skips missing dots", () => {
    const parsed = parseFredObservations([
      { date: "2024-01-01", value: "3.5" },
      { date: "2024-02-01", value: "." },
      { date: "2024-03-01", value: "abc" },
      { date: "2024-04-01", value: "4.1" },
    ]);

    expect(parsed).toEqual([
      { observedFor: "2024-01-01", value: 3.5 },
      { observedFor: "2024-04-01", value: 4.1 },
    ]);
  });
});

describe("fetchFredSeriesObservations", () => {
  it("calls FRED API and parses observations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        observations: [
          { date: "2024-01-01", value: "100.2" },
          { date: "2024-02-01", value: "." },
        ],
      }),
    });

    const rows = await fetchFredSeriesObservations("CPIAUCSL", {
      apiKey: "test-key",
      observationStart: "2024-01-01",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(rows).toEqual([{ observedFor: "2024-01-01", value: 100.2 }]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const calledUrl = String(fetchImpl.mock.calls[0]?.[0]);
    expect(calledUrl).toContain("series_id=CPIAUCSL");
    expect(calledUrl).toContain("api_key=test-key");
    expect(calledUrl).toContain("observation_start=2024-01-01");
  });

  it("throws on FRED API error payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        error_code: 400,
        error_message:
          "Bad Request.  The value for variable api_key is not a 32 character alpha-numeric lower-case string.",
      }),
    });

    await expect(
      fetchFredSeriesObservations("CPIAUCSL", {
        apiKey: "bad",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/FRED error/);
  });
});
