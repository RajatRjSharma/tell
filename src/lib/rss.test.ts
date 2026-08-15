import { describe, expect, it } from "vitest";
import { normalizeFeedDate, parseRssXml } from "@/lib/rss";

const FED_SAMPLE = `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0">
  <channel>
    <title>FRB: Press Release - Monetary Policy</title>
    <item>
      <title>Federal Reserve issues FOMC statement</title>
      <link><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm]]></link>
      <guid><![CDATA[https://www.federalreserve.gov/newsevents/pressreleases/monetary20260729a.htm]]></guid>
      <description><![CDATA[Federal Reserve issues FOMC statement]]></description>
      <category>Monetary Policy</category>
      <pubDate><![CDATA[Wed, 29 Jul 2026 18:00:00 GMT]]></pubDate>
    </item>
  </channel>
</rss>`;

const ATOM_SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>BoE rate decision</title>
    <id>urn:boe:1</id>
    <link href="https://example.com/boe"/>
    <updated>2026-08-10T12:00:00Z</updated>
    <summary>Bank Rate held</summary>
  </entry>
</feed>`;

describe("parseRssXml", () => {
  it("parses RSS 2 items with CDATA", () => {
    const items = parseRssXml(FED_SAMPLE);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Federal Reserve issues FOMC statement");
    expect(items[0]?.link).toContain("federalreserve.gov");
    expect(items[0]?.categories).toEqual(["Monetary Policy"]);
  });

  it("parses Atom entries", () => {
    const items = parseRssXml(ATOM_SAMPLE);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("BoE rate decision");
    expect(items[0]?.link).toBe("https://example.com/boe");
    expect(items[0]?.guid).toBe("urn:boe:1");
  });
});

describe("normalizeFeedDate", () => {
  it("normalizes RFC822 and ISO dates", () => {
    expect(normalizeFeedDate("Wed, 29 Jul 2026 18:00:00 GMT")).toBe(
      "2026-07-29",
    );
    expect(normalizeFeedDate("2026-08-10T12:00:00Z")).toBe("2026-08-10");
    expect(normalizeFeedDate("not-a-date")).toBeNull();
  });
});
