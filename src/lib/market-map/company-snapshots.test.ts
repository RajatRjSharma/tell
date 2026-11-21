import { describe, expect, it, vi } from "vitest";
import type { MapCompany } from "@/data/companies";
import type { AssetBar } from "@/lib/yahoo";
import {
  buildCompanySnapshot,
  fetchFinnhubProfile,
  normalizeCurrency,
  type SnapshotDeps,
} from "./company-snapshots";

const tsm: MapCompany = {
  symbol: "TSM",
  name: "TSMC",
  country: "TW",
  sector: "Technology",
};

function bars(closes: number[], startDay = 1): AssetBar[] {
  return closes.map((close, index) => ({
    date: `2026-07-${String(startDay + index).padStart(2, "0")}`,
    open: null,
    high: null,
    low: null,
    close,
    volume: null,
  }));
}

function deps(overrides: Partial<SnapshotDeps> = {}): SnapshotDeps {
  return {
    profile: async () => ({ marketCapMillions: 50_000_000, currency: "TWD" }),
    bars: async () => bars([200, 210]),
    unitsPerUsd: async () => 31.25,
    openSessionDate: null,
    ...overrides,
  };
}

describe("normalizeCurrency", () => {
  it("turns pence quotes into pounds", () => {
    expect(normalizeCurrency("GBp")).toEqual({ code: "GBP", divisor: 100 });
    expect(normalizeCurrency("GBX")).toEqual({ code: "GBP", divisor: 100 });
    expect(normalizeCurrency("usd")).toEqual({ code: "USD", divisor: 1 });
  });
});

describe("buildCompanySnapshot", () => {
  it("converts the reporting-currency cap to US dollars", async () => {
    const snapshot = await buildCompanySnapshot(tsm, deps());
    expect(snapshot.marketCapUsd).toBeCloseTo(1.6e12);
    expect(snapshot.close).toBe(210);
    expect(snapshot.changes["1d"]).toBeCloseTo(0.05);
    expect(snapshot.asOfDate).toBe("2026-07-02");
  });

  it("skips FX for US dollar reporters", async () => {
    const unitsPerUsd = vi.fn(async () => 99);
    const snapshot = await buildCompanySnapshot(
      tsm,
      deps({
        profile: async () => ({ marketCapMillions: 1_000, currency: "USD" }),
        unitsPerUsd,
      }),
    );
    expect(snapshot.marketCapUsd).toBe(1e9);
    expect(unitsPerUsd).not.toHaveBeenCalled();
  });

  it("drops the bar for a session still in progress", async () => {
    const snapshot = await buildCompanySnapshot(
      tsm,
      deps({
        bars: async () => bars([200, 210, 230]),
        openSessionDate: "2026-07-03",
      }),
    );
    expect(snapshot.close).toBe(210);
    expect(snapshot.asOfDate).toBe("2026-07-02");
  });

  it("uses the Yahoo symbol when it differs", async () => {
    const barsFn = vi.fn(async () => bars([1, 2]));
    await buildCompanySnapshot(
      { ...tsm, symbol: "BRK.B", yahoo: "BRK-B" },
      deps({ bars: barsFn }),
    );
    expect(barsFn).toHaveBeenCalledWith("BRK-B");
  });

  it("rejects thin history and missing FX", async () => {
    await expect(
      buildCompanySnapshot(tsm, deps({ bars: async () => bars([1]) })),
    ).rejects.toThrow("not enough daily bars");
    await expect(
      buildCompanySnapshot(tsm, deps({ unitsPerUsd: async () => Number.NaN })),
    ).rejects.toThrow("no FX rate for TWD");
  });
});

describe("fetchFinnhubProfile", () => {
  it("reads market cap and currency", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ marketCapitalization: 3_400_000, currency: "USD" }),
        ),
    );
    await expect(
      fetchFinnhubProfile("AAPL", { apiKey: "k", fetchImpl }),
    ).resolves.toEqual({ marketCapMillions: 3_400_000, currency: "USD" });
  });

  it("fails on HTTP errors and empty profiles", async () => {
    await expect(
      fetchFinnhubProfile("X", {
        apiKey: "k",
        fetchImpl: async () => new Response("", { status: 429 }),
      }),
    ).rejects.toThrow("HTTP 429");
    await expect(
      fetchFinnhubProfile("X", {
        apiKey: "k",
        fetchImpl: async () => new Response("{}"),
      }),
    ).rejects.toThrow("no market cap");
  });
});
