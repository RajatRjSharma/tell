import type { Client } from "@libsql/client";
import { enrichEvent, buildEventId } from "@/lib/events/enrich";
import { POLICY_FEEDS, type PolicyFeed } from "@/lib/events/feeds";
import { upsertEvents, type EventUpsert } from "@/lib/events/store";
import { fetchRssFeed, normalizeFeedDate, parseRssXml } from "@/lib/rss";

export type IngestEventsResult = {
  feeds: number;
  items: number;
  written: number;
  skipped: number;
  errors: string[];
};

export function rssItemToEventUpsert(
  feed: PolicyFeed,
  item: {
    title: string;
    link: string | null;
    guid: string | null;
    summary: string | null;
    pubDate: string | null;
    categories: string[];
  },
  fallbackDate: string,
): EventUpsert | null {
  const date = normalizeFeedDate(item.pubDate) ?? fallbackDate;
  if (!item.title.trim()) return null;

  const enrichment = enrichEvent(feed, item);
  return {
    id: buildEventId(feed.source, item),
    date,
    countryCode: feed.countryCode,
    type: enrichment.type,
    title: item.title.trim(),
    summary: item.summary,
    url: item.link,
    sentiment: enrichment.sentiment,
    assetsImpact: enrichment.assetsImpact,
    source: feed.source,
  };
}

export async function ingestPolicyEvents(
  db: Client,
  options?: {
    feeds?: PolicyFeed[];
    fetchImpl?: typeof fetch;
    maxPerFeed?: number;
    today?: string;
  },
): Promise<IngestEventsResult> {
  const feeds = options?.feeds ?? POLICY_FEEDS;
  const maxPerFeed = options?.maxPerFeed ?? 40;
  const today = options?.today ?? new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  let items = 0;
  let written = 0;
  let skipped = 0;

  for (const feed of feeds) {
    try {
      const xml = await fetchRssFeed(feed.url, {
        fetchImpl: options?.fetchImpl,
      });
      const parsed = parseRssXml(xml).slice(0, maxPerFeed);
      items += parsed.length;

      const rows: EventUpsert[] = [];
      for (const item of parsed) {
        const row = rssItemToEventUpsert(feed, item, today);
        if (!row) {
          skipped += 1;
          continue;
        }
        rows.push(row);
      }

      written += await upsertEvents(db, rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed ${feed.id}`;
      errors.push(`${feed.id}: ${message}`);
    }
  }

  return {
    feeds: feeds.length,
    items,
    written,
    skipped,
    errors,
  };
}
