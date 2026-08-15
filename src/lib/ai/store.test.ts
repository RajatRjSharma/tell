import { describe, expect, it, vi } from "vitest";
import {
  briefStorageSymbol,
  diffBriefs,
  getLatestResearchBrief,
  listResearchBriefs,
  MARKET_BRIEF_SYMBOL,
  rowToBrief,
  upsertResearchBrief,
} from "@/lib/ai/store";
import { AI_DISCLAIMER } from "@/lib/ai/types";

function makeBrief(overrides?: Partial<Parameters<typeof diffBriefs>[0]>) {
  return {
    title: "SPY brief",
    summary: "Neutral under inflationary pressure with soft momentum.",
    bullets: ["Neutral score", "Mixed inflation"],
    risks: ["Policy surprise"],
    model: "gemini-3.1-flash-lite",
    provider: "gemini" as const,
    asOf: "2026-08-14",
    symbol: "SPY",
    horizon: "1d",
    cached: false,
    source: "live" as const,
    disclaimer: AI_DISCLAIMER,
    ...overrides,
  };
}

describe("briefStorageSymbol", () => {
  it("uses market sentinel when blank", () => {
    expect(briefStorageSymbol(null)).toBe(MARKET_BRIEF_SYMBOL);
    expect(briefStorageSymbol("spy")).toBe("SPY");
  });
});

describe("diffBriefs", () => {
  it("returns null without previous", () => {
    expect(diffBriefs(makeBrief(), null)).toBeNull();
  });

  it("detects added and removed bullets", () => {
    const delta = diffBriefs(
      makeBrief({ bullets: ["Neutral score", "Fresh momentum"] }),
      makeBrief({
        asOf: "2026-08-13",
        bullets: ["Neutral score", "Mixed inflation"],
      }),
    );

    expect(delta?.addedBullets).toEqual(["Fresh momentum"]);
    expect(delta?.removedBullets).toEqual(["Mixed inflation"]);
    expect(delta?.previousAsOf).toBe("2026-08-13");
  });
});

describe("rowToBrief", () => {
  it("parses stored json arrays", () => {
    const brief = rowToBrief({
      symbol: "SPY",
      horizon: "1d",
      as_of_date: "2026-08-14",
      title: "SPY brief",
      summary: "Summary text for the brief.",
      bullets_json: JSON.stringify(["One", "Two"]),
      risks_json: JSON.stringify(["Risk"]),
      model: "gemini-3.1-flash-lite",
      provider: "gemini",
      created_at: "2026-08-15T00:00:00Z",
    });

    expect(brief.bullets).toEqual(["One", "Two"]);
    expect(brief.source).toBe("database");
  });
});

describe("research brief store queries", () => {
  it("upserts and lists through client", async () => {
    const rows: Record<string, unknown>[] = [];
    const db = {
      execute: vi.fn(async (query: { sql: string; args?: unknown[] }) => {
        if (query.sql.includes("INSERT INTO research_briefs")) {
          const [
            symbol,
            horizon,
            asOf,
            title,
            summary,
            bulletsJson,
            risksJson,
            model,
            provider,
          ] = query.args as string[];
          const existing = rows.findIndex(
            (row) =>
              row.symbol === symbol &&
              row.horizon === horizon &&
              row.as_of_date === asOf &&
              row.model === model,
          );
          const next = {
            symbol,
            horizon,
            as_of_date: asOf,
            title,
            summary,
            bullets_json: bulletsJson,
            risks_json: risksJson,
            model,
            provider,
            created_at: "2026-08-15T00:00:00Z",
          };
          if (existing >= 0) rows[existing] = next;
          else rows.push(next);
          return { rows: [] };
        }

        if (query.sql.includes("FROM research_briefs")) {
          const [symbol, horizon] = query.args as string[];
          const matched = rows
            .filter((row) => row.symbol === symbol && row.horizon === horizon)
            .sort((a, b) =>
              String(b.as_of_date).localeCompare(String(a.as_of_date)),
            );
          const limit =
            typeof query.args?.[query.args.length - 1] === "number"
              ? Number(query.args[query.args.length - 1])
              : matched.length;
          return { rows: matched.slice(0, limit) };
        }

        return { rows: [] };
      }),
    };

    await upsertResearchBrief(db as never, makeBrief());
    await upsertResearchBrief(
      db as never,
      makeBrief({
        asOf: "2026-08-13",
        title: "Prior SPY brief",
        summary: "Earlier summary for delta testing purposes.",
        bullets: ["Old bullet"],
      }),
    );

    const listed = await listResearchBriefs(db as never, {
      symbol: "SPY",
      horizon: "1d",
      limit: 7,
    });
    expect(listed).toHaveLength(2);
    expect(listed[0]?.asOf).toBe("2026-08-14");

    const latest = await getLatestResearchBrief(db as never, {
      symbol: "SPY",
      horizon: "1d",
    });
    expect(latest?.title).toBe("SPY brief");
  });
});
