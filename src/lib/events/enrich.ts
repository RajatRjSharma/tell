import { createHash } from "node:crypto";
import type { RssItem } from "@/lib/rss";
import type { PolicyFeed } from "@/lib/events/feeds";

export type EventEnrichment = {
  type: string;
  sentiment: number | null;
  assetsImpact: string[];
};

const HAWKISH =
  /\b(hike|hiking|tighten|tightening|restrictive|higher rates|rate increase|hawkish)\b/i;
const DOVISH =
  /\b(cut|cutting|ease|easing|accommodative|lower rates|rate reduction|dovish|stimulus)\b/i;
const POLICY =
  /\b(fomc|monetary policy|interest rate|bank rate|policy rate|qe|qt|balance sheet|inflation target)\b/i;
const SPEECH = /\b(speech|remarks|testimony|hearing|interview|panel)\b/i;
const DATA = /\b(survey|statistics|data|report|minutes|accounts)\b/i;

const SOURCE_ASSETS: Record<string, string[]> = {
  Fed: ["SPY", "TLT", "GLD", "USDJPY"],
  ECB: ["EWG", "EURUSD", "TLT", "GLD"],
  BoE: ["EWU", "GBPUSD", "TLT", "GLD"],
};

export function buildEventId(source: string, item: RssItem): string {
  const material =
    item.guid || item.link || `${item.title}|${item.pubDate ?? ""}`;
  const digest = createHash("sha256")
    .update(`${source}:${material}`)
    .digest("hex")
    .slice(0, 24);
  return `${source.toLowerCase()}:${digest}`;
}

export function enrichEvent(feed: PolicyFeed, item: RssItem): EventEnrichment {
  const text = `${item.title} ${item.summary ?? ""} ${item.categories.join(" ")}`;
  let sentiment: number | null = null;
  if (HAWKISH.test(text) && !DOVISH.test(text)) sentiment = 0.35;
  else if (DOVISH.test(text) && !HAWKISH.test(text)) sentiment = -0.35;
  else if (HAWKISH.test(text) && DOVISH.test(text)) sentiment = 0;

  let type = feed.type;
  if (SPEECH.test(text)) type = "speech";
  else if (POLICY.test(text) || /monetary/i.test(item.categories.join(" "))) {
    type = "policy";
  } else if (DATA.test(text)) type = "data";

  return {
    type,
    sentiment,
    assetsImpact: SOURCE_ASSETS[feed.source] ?? [],
  };
}
