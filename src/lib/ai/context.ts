import type { Client } from "@libsql/client";
import { listLatestOutlook } from "@/lib/api/outlook";
import { listReadings } from "@/lib/api/readings-query";
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
  return [...citations];
}

export async function buildResearchContext(
  db: Client,
  options?: {
    symbol?: string | null;
    horizon?: string;
    macroIndicators?: readonly string[];
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
  const macroRows = await Promise.all(
    macroIndicators.map((indicatorId) =>
      listReadings(db, {
        countryCode: "US",
        indicatorId,
        limit: 1,
      }),
    ),
  );

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
  };
}
