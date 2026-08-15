export type RssItem = {
  title: string;
  link: string | null;
  guid: string | null;
  summary: string | null;
  pubDate: string | null;
  categories: string[];
};

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(raw: string): string {
  return decodeXmlEntities(raw.replace(/<[^>]+>/g, " "));
}

function tagContents(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) != null) {
    out.push(decodeXmlEntities(match[1] ?? ""));
  }
  return out;
}

function firstTag(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const values = tagContents(block, tag);
    if (values[0]) return values[0];
  }
  return null;
}

function parseLink(block: string): string | null {
  const closed = firstTag(block, ["link"]);
  if (closed && /^https?:\/\//i.test(closed)) return closed;

  const href = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (href?.[1]) return decodeXmlEntities(href[1]);

  return closed;
}

/** Parse RSS 2.0 or Atom XML into normalized items. */
export function parseRssXml(xml: string): RssItem[] {
  const cleaned = xml.replace(/^\uFEFF/, "");
  const itemBlocks = [
    ...cleaned.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...cleaned.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ].map((match) => match[0]);

  const items: RssItem[] = [];
  for (const block of itemBlocks) {
    const title = firstTag(block, ["title"]);
    if (!title) continue;

    const summaryRaw =
      firstTag(block, ["description", "summary", "content"]) ?? null;
    const guid =
      firstTag(block, ["guid", "id"]) ??
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ??
      null;

    items.push({
      title: stripTags(title),
      link: parseLink(block),
      guid: guid ? stripTags(guid) : null,
      summary: summaryRaw ? stripTags(summaryRaw).slice(0, 1200) : null,
      pubDate: firstTag(block, ["pubDate", "published", "updated", "dc:date"]),
      categories: tagContents(block, "category").map(stripTags).filter(Boolean),
    });
  }

  return items;
}

/** Normalize feed dates to YYYY-MM-DD (UTC calendar day). */
export function normalizeFeedDate(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

export async function fetchRssFeed(
  url: string,
  options?: { fetchImpl?: typeof fetch; userAgent?: string },
): Promise<string> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    headers: {
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      "User-Agent": options?.userAgent ?? "TellMacroBot/0.1 (events-ingest)",
    },
  });
  if (!response.ok) {
    throw new Error(`RSS fetch failed (${response.status}) for ${url}`);
  }
  return response.text();
}
