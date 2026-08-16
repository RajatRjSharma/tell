import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  loadAssetCloses: vi.fn(),
}));

vi.mock("@/lib/events/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/events/store")>();
  return { ...actual, listEvents: mocks.listEvents };
});

vi.mock("@/lib/features/load", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/features/load")>();
  return { ...actual, loadAssetCloses: mocks.loadAssetCloses };
});

import { buildEventImpactReport } from "@/lib/events/impact";
import type { PolicyEvent } from "@/lib/events/store";

const events: PolicyEvent[] = [
  {
    id: "ecb:hawkish",
    date: "2026-01-05",
    countryCode: "DE",
    type: "policy",
    title: "ECB maintains a restrictive policy stance",
    summary: null,
    url: null,
    sentiment: 0.35,
    assetsImpact: ["EWG", "EURUSD"],
    source: "ECB",
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: "ecb:dovish",
    date: "2026-01-07",
    countryCode: "DE",
    type: "policy",
    title: "ECB signals easier policy",
    summary: null,
    url: null,
    sentiment: -0.35,
    assetsImpact: ["EWG", "EURUSD"],
    source: "ECB",
    createdAt: "2026-01-07T00:00:00Z",
  },
];

const closes: Record<string, { date: string; value: number }[]> = {
  INDA: [
    { date: "2026-01-05", value: 100 },
    { date: "2026-01-06", value: 102 },
    { date: "2026-01-07", value: 101 },
    { date: "2026-01-08", value: 100 },
  ],
  EWG: [
    { date: "2026-01-05", value: 200 },
    { date: "2026-01-06", value: 198 },
    { date: "2026-01-07", value: 202 },
    { date: "2026-01-08", value: 204 },
  ],
};

describe("event impact report orchestration", () => {
  beforeEach(() => {
    mocks.listEvents.mockReset();
    mocks.loadAssetCloses.mockReset();
    mocks.listEvents.mockResolvedValue(events);
    mocks.loadAssetCloses.mockImplementation(
      async (_db: Client, symbol: string) => closes[symbol] ?? [],
    );
  });

  it("studies every scoped symbol against the chosen policy source", async () => {
    const report = await buildEventImpactReport({} as Client, {
      source: "ECB",
      symbols: ["INDA", "EWG"],
      horizons: ["1d"],
      sentimentFilter: "any",
    });

    expect(mocks.listEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: "ECB" }),
    );
    expect(mocks.loadAssetCloses).toHaveBeenCalledTimes(2);
    expect(report).toMatchObject({
      source: "ECB",
      eventCount: 2,
      assets: ["INDA", "EWG"],
      horizons: ["1d"],
    });
    expect(report?.rows).toHaveLength(2);
    expect(report?.rows.every((row) => row.stats.n === 2)).toBe(true);
  });

  it("applies the tone filter before calculating return samples", async () => {
    const report = await buildEventImpactReport({} as Client, {
      source: "ECB",
      symbols: ["EWG"],
      horizons: ["1d"],
      sentimentFilter: "hawkish",
    });

    expect(report?.eventCount).toBe(1);
    expect(report?.rows[0]?.stats.n).toBe(1);
    expect(report?.rows[0]?.stats.median).toBeCloseTo(-0.01);
  });
});
