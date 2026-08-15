import { describe, expect, it } from "vitest";
import { buildEventId, enrichEvent } from "@/lib/events/enrich";
import { POLICY_FEEDS } from "@/lib/events/feeds";
import { rssItemToEventUpsert } from "@/lib/events/ingest";
import { rowToPolicyEvent } from "@/lib/events/store";

describe("enrichEvent", () => {
  it("scores hawkish vs dovish headlines", () => {
    const feed = POLICY_FEEDS[0]!;
    const hike = enrichEvent(feed, {
      title: "Fed signals further rate hike",
      link: null,
      guid: "1",
      summary: "Restrictive stance",
      pubDate: null,
      categories: ["Monetary Policy"],
    });
    expect(hike.sentiment).toBeGreaterThan(0);
    expect(hike.type).toBe("policy");

    const cut = enrichEvent(feed, {
      title: "Committee cuts Bank Rate",
      link: null,
      guid: "2",
      summary: "Easing cycle continues",
      pubDate: null,
      categories: [],
    });
    expect(cut.sentiment).toBeLessThan(0);
  });
});

describe("buildEventId / rssItemToEventUpsert", () => {
  it("is stable for the same guid", () => {
    const item = {
      title: "FOMC statement",
      link: "https://example.com/a",
      guid: "https://example.com/a",
      summary: "statement",
      pubDate: "Wed, 29 Jul 2026 18:00:00 GMT",
      categories: ["Monetary Policy"],
    };
    expect(buildEventId("Fed", item)).toBe(buildEventId("Fed", item));

    const row = rssItemToEventUpsert(POLICY_FEEDS[0]!, item, "2026-08-15");
    expect(row?.date).toBe("2026-07-29");
    expect(row?.source).toBe("Fed");
    expect(row?.assetsImpact).toContain("SPY");
  });
});

describe("rowToPolicyEvent", () => {
  it("parses assets impact json", () => {
    const event = rowToPolicyEvent({
      id: "fed:abc",
      date: "2026-07-29",
      country_code: "US",
      type: "policy",
      title: "FOMC",
      summary: null,
      url: "https://example.com",
      sentiment: 0.2,
      assets_impact_json: JSON.stringify(["SPY", "TLT"]),
      source: "Fed",
      created_at: "2026-08-15T00:00:00Z",
    });
    expect(event.assetsImpact).toEqual(["SPY", "TLT"]);
  });
});
