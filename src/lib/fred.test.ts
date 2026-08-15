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
      {
        observedFor: "2024-01-01",
        value: 3.5,
        releasedAt: null,
        vintage: undefined,
      },
      {
        observedFor: "2024-04-01",
        value: 4.1,
        releasedAt: null,
        vintage: undefined,
      },
    ]);
  });

  it("captures ALFRED realtime_start as vintage", () => {
    const parsed = parseFredObservations(
      [
        {
          date: "2024-01-01",
          value: "3.5",
          realtime_start: "2024-02-10",
          realtime_end: "9999-12-31",
        },
      ],
      { alfred: true },
    );
    expect(parsed).toEqual([
      {
        observedFor: "2024-01-01",
        value: 3.5,
        releasedAt: "2024-02-10",
        vintage: "2024-02-10",
      },
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

    expect(rows).toEqual([
      {
        observedFor: "2024-01-01",
        value: 100.2,
        releasedAt: null,
        vintage: undefined,
      },
    ]);
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
