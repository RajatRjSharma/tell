import type { Client } from "@libsql/client";
import { loadAssetCloses } from "@/lib/features/load";
import { forwardReturn } from "@/lib/forecasts/evaluate";
import { listEvents, type PolicyEvent } from "@/lib/events/store";
import { SOURCE_ASSETS } from "@/lib/events/enrich";
import {
  DEFAULT_HORIZONS,
  horizonToBars,
  parseHorizons,
} from "@/lib/signals/horizons";

export type ImpactStats = {
  n: number;
  mean: number | null;
  median: number | null;
  hitRateUp: number | null;
};

export type AssetHorizonImpact = {
  symbol: string;
  horizon: string;
  stats: ImpactStats;
};

export type EventImpactReport = {
  source: string;
  sentimentFilter: "any" | "hawkish" | "dovish";
  eventCount: number;
  oldestEvent: string | null;
  newestEvent: string | null;
  horizons: string[];
  assets: string[];
  rows: AssetHorizonImpact[];
  sampleEvents: Array<{
    id: string;
    date: string;
    title: string;
    sentiment: number | null;
  }>;
  disclaimer: string;
};

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function summarizeReturnSample(returns: number[]): ImpactStats {
  const ups = returns.filter((value) => value > 0).length;
  return {
    n: returns.length,
    mean: mean(returns),
    median: median(returns),
    hitRateUp: returns.length === 0 ? null : ups / returns.length,
  };
}

export function assetsForSource(source: string): string[] {
  return SOURCE_ASSETS[source] ?? [];
}

export function assetsForImpactStudy(
  source: string,
  symbols?: string[] | null,
): string[] {
  if (!symbols) return assetsForSource(source);
  return [
    ...new Set(
      symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean),
    ),
  ];
}

/** Invert SOURCE_ASSETS — which policy feeds matter for a symbol. */
export function sourcesForSymbol(symbol: string): string[] {
  const upper = symbol.trim().toUpperCase();
  const sources: string[] = [];
  for (const [source, assets] of Object.entries(SOURCE_ASSETS)) {
    if (assets.includes(upper)) sources.push(source);
  }
  return sources;
}

export function primarySourceForSymbol(symbol: string): string | null {
  return sourcesForSymbol(symbol)[0] ?? null;
}

export function sentimentBucket(
  sentiment: number | null,
): "hawkish" | "dovish" | "neutral" {
  if (sentiment == null) return "neutral";
  if (sentiment > 0.1) return "hawkish";
  if (sentiment < -0.1) return "dovish";
  return "neutral";
}

export function filterEventsForStudy(
  events: PolicyEvent[],
  options?: {
    sentimentFilter?: "any" | "hawkish" | "dovish";
    types?: string[] | null;
  },
): PolicyEvent[] {
  const sentimentFilter = options?.sentimentFilter ?? "any";
  const types = options?.types ?? null;

  return events.filter((event) => {
    if (types && types.length > 0) {
      if (!event.type || !types.includes(event.type)) return false;
    }
    if (sentimentFilter === "any") return true;
    return sentimentBucket(event.sentiment) === sentimentFilter;
  });
}

export function collectForwardReturns(
  closes: { date: string; value: number }[],
  eventDates: string[],
  horizon: string,
): number[] {
  const bars = horizonToBars(horizon);
  const out: number[] = [];
  for (const date of eventDates) {
    const ret = forwardReturn(closes, date, bars);
    if (ret != null) out.push(ret);
  }
  return out;
}

export function buildImpactRows(
  eventDates: string[],
  closesBySymbol: Map<string, { date: string; value: number }[]>,
  assets: string[],
  horizons: string[],
): AssetHorizonImpact[] {
  const rows: AssetHorizonImpact[] = [];
  for (const symbol of assets) {
    const closes = closesBySymbol.get(symbol) ?? [];
    for (const horizon of horizons) {
      const sample = collectForwardReturns(closes, eventDates, horizon);
      rows.push({
        symbol,
        horizon,
        stats: summarizeReturnSample(sample),
      });
    }
  }
  return rows;
}

export async function buildEventImpactReport(
  db: Client,
  options?: {
    source?: string | null;
    symbol?: string | null;
    symbols?: string[] | null;
    horizons?: string[];
    sentimentFilter?: "any" | "hawkish" | "dovish";
    eventLimit?: number;
  },
): Promise<EventImpactReport | null> {
  const symbol = options?.symbol?.trim().toUpperCase() || null;
  const source =
    options?.source?.trim() ||
    (symbol ? primarySourceForSymbol(symbol) : null) ||
    "Fed";

  const horizons = options?.horizons?.length
    ? options.horizons
    : [...DEFAULT_HORIZONS];
  for (const horizon of horizons) horizonToBars(horizon);

  const sentimentFilter = options?.sentimentFilter ?? "any";
  const eventLimit = Math.min(Math.max(options?.eventLimit ?? 120, 1), 300);

  const rawEvents = await listEvents(db, {
    source,
    limit: eventLimit,
  });

  const events = filterEventsForStudy(rawEvents, {
    sentimentFilter,
    // Prefer policy/data events over speeches.
    types: null,
  });

  if (events.length === 0) return null;

  let assets = assetsForImpactStudy(source, options?.symbols);
  if (!options?.symbols && symbol && !assets.includes(symbol)) {
    assets = [symbol, ...assets];
  } else if (!options?.symbols && symbol) {
    assets = [symbol, ...assets.filter((item) => item !== symbol)];
  }

  const closesBySymbol = new Map<
    string,
    Awaited<ReturnType<typeof loadAssetCloses>>
  >();
  await Promise.all(
    assets.map(async (asset) => {
      closesBySymbol.set(asset, await loadAssetCloses(db, asset));
    }),
  );

  const eventDates = events.map((event) => event.date);
  const datesAsc = [...eventDates].sort();
  const rows = buildImpactRows(eventDates, closesBySymbol, assets, horizons);

  return {
    source,
    sentimentFilter,
    eventCount: events.length,
    oldestEvent: datesAsc[0] ?? null,
    newestEvent: datesAsc[datesAsc.length - 1] ?? null,
    horizons,
    assets,
    rows,
    sampleEvents: events.slice(0, 5).map((event) => ({
      id: event.id,
      date: event.date,
      title: event.title,
      sentiment: event.sentiment,
    })),
    disclaimer:
      "Historical analogues only. Past forward returns after similar policy events are not predictions.",
  };
}

export function parseImpactHorizons(raw: string | null): string[] {
  if (!raw) return [...DEFAULT_HORIZONS];
  return parseHorizons(raw);
}
