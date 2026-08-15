import type { Client } from "@libsql/client";
import { listLatestOutlook } from "@/lib/api/outlook";
import { listReadings } from "@/lib/api/readings-query";
import { listEvents } from "@/lib/events/store";
import type { ResearchContext } from "@/lib/ai/types";

const DEFAULT_MACRO_INDICATORS = [
  "CPI",
  "UNRATE",
  "FEDFUNDS",
  "DGS10",
  "T10Y2Y",
  "INDPRO",
] as const;

export function formatResearchContext(context: ResearchContext): string {
  const lines: string[] = [
    `as_of=${context.asOf ?? "unknown"}`,
    `regime=${context.regime ?? "unknown"}`,
    `horizon=${context.horizon}`,
    `focus_symbol=${context.symbol ?? "market"}`,
    "",
    "signals:",
  ];

  for (const signal of context.signals) {
    const confidence =
      signal.confidence == null
        ? "n/a"
        : `${Math.round(signal.confidence * 100)}%`;
    lines.push(
      `- ${signal.symbol} ${signal.horizon}: ${signal.direction} score=${signal.score.toFixed(2)} confidence=${confidence}`,
    );
    for (const driver of signal.drivers.slice(0, 3)) {
      lines.push(`  driver: ${driver}`);
    }
  }

  lines.push("", "latest_us_macro:");
  for (const reading of context.macro) {
    lines.push(
      `- ${reading.indicatorId} ${reading.observedFor}=${reading.value}${reading.source ? ` (${reading.source})` : ""}`,
    );
  }

  lines.push("", "recent_policy_events:");
  if (context.events.length === 0) {
    lines.push("- none");
  } else {
    for (const event of context.events) {
      lines.push(
        `- ${event.date} ${event.source ?? "source"} [${event.type ?? "event"}]: ${event.title}`,
      );
    }
  }

  if (context.ragHits && context.ragHits.length > 0) {
    lines.push("", "retrieved_notes:");
    for (const hit of context.ragHits) {
      lines.push(`- [${hit.kind}] ${hit.title}: ${hit.body.slice(0, 280)}`);
    }
  }

  return lines.join("\n");
}

export function extractCitations(context: ResearchContext): string[] {
  const citations = new Set<string>();
  if (context.regime) citations.add(`regime:${context.regime}`);
  if (context.asOf) citations.add(`signals_as_of:${context.asOf}`);
  for (const signal of context.signals.slice(0, 8)) {
    citations.add(`${signal.symbol}:${signal.horizon}:${signal.direction}`);
  }
  for (const reading of context.macro.slice(0, 6)) {
    citations.add(`${reading.indicatorId}:${reading.observedFor}`);
  }
  for (const event of context.events.slice(0, 4)) {
    citations.add(
      `event:${event.source ?? "policy"}:${event.date}:${event.title.slice(0, 48)}`,
    );
  }
  for (const hit of (context.ragHits ?? []).slice(0, 4)) {
    citations.add(`rag:${hit.kind}:${hit.refId}`);
  }
  return [...citations];
}

export async function buildResearchContext(
  db: Client,
  options?: {
    symbol?: string | null;
    horizon?: string;
    macroIndicators?: readonly string[];
    query?: string | null;
  },
): Promise<ResearchContext> {
  const horizon = options?.horizon ?? "1d";
  const symbol = options?.symbol?.trim().toUpperCase() || null;
  const signals = await listLatestOutlook(db, {
    symbols: symbol ? [symbol] : null,
    horizons: [horizon],
  });

  const marketSignals =
    symbol != null
      ? signals
      : (await listLatestOutlook(db, { horizons: [horizon] })).slice(0, 12);

  const macroIndicators = options?.macroIndicators ?? DEFAULT_MACRO_INDICATORS;
  const { searchResearchFts } = await import("@/lib/ai/rag");
  const [macroRows, events, ragHits] = await Promise.all([
    Promise.all(
      macroIndicators.map((indicatorId) =>
        listReadings(db, {
          countryCode: "US",
          indicatorId,
          limit: 1,
        }),
      ),
    ),
    listEvents(db, {
      limit: 6,
      symbol,
    }),
    options?.query
      ? searchResearchFts(db, options.query, 6)
      : Promise.resolve([]),
  ]);

  const regime =
    marketSignals.find((row) => row.regime)?.regime ??
    signals.find((row) => row.regime)?.regime ??
    null;
  const asOf =
    marketSignals.reduce<string | null>((latest, row) => {
      if (!latest || row.asOfDate > latest) return row.asOfDate;
      return latest;
    }, null) ?? null;

  return {
    asOf,
    regime,
    horizon,
    symbol,
    signals: marketSignals.map((row) => ({
      symbol: row.symbol,
      horizon: row.horizon,
      direction: row.direction,
      score: row.score,
      confidence: row.confidence,
      drivers: row.drivers.map((driver) => `${driver.code}: ${driver.detail}`),
    })),
    macro: macroRows.flat().map((row) => ({
      indicatorId: row.indicatorId,
      observedFor: row.observedFor,
      value: row.value,
      source: row.source,
    })),
    events: events.map((event) => ({
      date: event.date,
      source: event.source,
      title: event.title,
      type: event.type,
    })),
    ragHits: ragHits.map((hit) => ({
      kind: hit.kind,
      refId: hit.refId,
      title: hit.title,
      body: hit.body,
    })),
  };
}
