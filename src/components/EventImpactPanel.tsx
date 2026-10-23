"use client";

import { useEffect, useMemo, useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";
import {
  SMALL_SAMPLE,
  explainImpactCell,
  impactIntensity,
} from "@/lib/charts/explain";
import { POLICY_SOURCES } from "@/lib/events/feeds";

type ImpactStats = {
  n: number;
  mean: number | null;
  median: number | null;
  hitRateUp: number | null;
};

type AssetHorizonImpact = {
  symbol: string;
  horizon: string;
  stats: ImpactStats;
};

type EventImpactReport = {
  source: string;
  sentimentFilter: string;
  eventCount: number;
  oldestEvent: string | null;
  newestEvent: string | null;
  horizons: string[];
  assets: string[];
  rows: AssetHorizonImpact[];
  disclaimer: string;
};

type ImpactState = {
  key: string;
  status: "ready" | "error";
  report: EventImpactReport | null;
  message: string | null;
  error: string | null;
};

function pct(value: number | null): string {
  if (value == null) return "n/a";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`;
}

function hitPct(value: number | null): string {
  if (value == null) return "n/a";
  return `${Math.round(value * 100)}%`;
}

export function EventImpactPanel({
  symbols,
  scopeLabel,
  enabled = true,
}: {
  symbols: string[];
  scopeLabel: string;
  enabled?: boolean;
}) {
  const [source, setSource] = useState<string>("Fed");
  const [sentiment, setSentiment] = useState<"any" | "hawkish" | "dovish">(
    "any",
  );
  const [result, setResult] = useState<ImpactState | null>(null);
  const [focusCell, setFocusCell] = useState<string | null>(null);
  const symbolKey = [...new Set(symbols)].sort().join(",");
  const requestKey = `${source}:${symbolKey}:${sentiment}`;
  const active = result?.key === requestKey ? result : null;
  const state = !enabled ? "auth" : active ? active.status : "loading";
  const report = active?.report ?? null;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      source,
      sentiment,
      horizons: "1d,1w,1m",
    });
    if (symbolKey) params.set("symbols", symbolKey);

    fetch(`/api/events/impact?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          report: EventImpactReport | null;
          message?: string;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Impact study unavailable");
        }
        setResult({
          key: requestKey,
          status: "ready",
          report: data.report,
          message: data.message ?? null,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          key: requestKey,
          status: "error",
          report: null,
          message: null,
          error:
            err instanceof Error ? err.message : "Impact study unavailable",
        });
      });

    return () => controller.abort();
  }, [requestKey, sentiment, source, symbolKey, enabled]);

  const matrix = useMemo(() => {
    if (!report) return [];
    return report.assets.map((asset) => ({
      symbol: asset,
      cells: report.horizons.map((horizon) => {
        const row = report.rows.find(
          (item) => item.symbol === asset && item.horizon === horizon,
        );
        return { horizon, stats: row?.stats ?? null };
      }),
    }));
  }, [report]);

  const columnMax = useMemo(() => {
    const max: Record<string, number> = {};
    for (const row of report?.rows ?? []) {
      const size = Math.abs(row.stats.median ?? 0);
      max[row.horizon] = Math.max(max[row.horizon] ?? 0, size);
    }
    return max;
  }, [report]);

  const focused = useMemo(() => {
    if (!report || !focusCell) return null;
    const [symbol, horizon] = focusCell.split("|");
    const row = report.rows.find(
      (item) => item.symbol === symbol && item.horizon === horizon,
    );
    if (!report.assets.includes(symbol!)) return null;
    return explainImpactCell({
      symbol: symbol!,
      horizon: horizon!,
      source: report.source,
      n: row?.stats.n ?? 0,
      median: row?.stats.median ?? null,
      hitRateUp: row?.stats.hitRateUp ?? null,
    });
  }, [focusCell, report]);

  return (
    <section
      className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
      data-testid="event-impact-panel"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            Event impact study
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            <EconomicTerm term="forwardReturn">Returns after</EconomicTerm>{" "}
            similar central-bank releases, shown as the{" "}
            <EconomicTerm term="median">median</EconomicTerm> and the share that
            went up. Choose a central bank; the study covers every market in the{" "}
            {scopeLabel} page scope. This is historical context, not a
            prediction for the next release.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label
            className="text-xs text-[var(--muted)]"
            htmlFor="impact-source"
          >
            Policy source
            <select
              id="impact-source"
              className="select-control ml-2 text-xs"
              value={source}
              disabled={!enabled}
              onChange={(event) => setSource(event.target.value)}
              data-testid="impact-source"
            >
              {POLICY_SOURCES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="text-xs text-[var(--muted)]"
            htmlFor="impact-sentiment"
          >
            Tone
            <select
              id="impact-sentiment"
              className="select-control ml-2 text-xs"
              value={sentiment}
              disabled={!enabled}
              onChange={(event) =>
                setSentiment(event.target.value as "any" | "hawkish" | "dovish")
              }
              data-testid="impact-sentiment"
            >
              <option value="any">All tones</option>
              <option value="hawkish">Hawkish tilt</option>
              <option value="dovish">Dovish tilt</option>
            </select>
          </label>
        </div>
      </div>

      <div className="px-5 py-4">
        {state === "auth" ? (
          <p className="text-sm text-[var(--muted)]">
            Sign in to load the event impact study.
          </p>
        ) : state === "error" ? (
          <p className="text-sm text-[var(--negative)]">{active?.error}</p>
        ) : state === "loading" ? (
          <p className="text-sm text-[var(--muted)]">Computing analogues…</p>
        ) : !report ? (
          <p className="text-sm text-[var(--muted)]">
            {active?.message ?? "No events available — run make ingest-events."}
          </p>
        ) : (
          <>
            <p className="text-xs text-[var(--muted)]">
              {report.source} · {report.eventCount} matching historical releases
              {report.oldestEvent && report.newestEvent
                ? ` · ${report.oldestEvent} → ${report.newestEvent}`
                : ""}
            </p>
            <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
              “{report.eventCount} releases” is the event sample considered. The
              n shown in each result cell can be smaller when enough later price
              data was not available for that market and time period.
            </p>

            <div
              className="mt-4 overflow-x-auto"
              aria-label="Event impact results table"
              tabIndex={0}
            >
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--line)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="py-2 pr-3 font-medium">Asset</th>
                    {report.horizons.map((horizon) => (
                      <th key={horizon} className="px-2 py-2 font-medium">
                        <EconomicTerm term="horizon">{horizon}</EconomicTerm>{" "}
                        <EconomicTerm term="median">med</EconomicTerm>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr
                      key={row.symbol}
                      className="border-b border-[var(--line)] last:border-0"
                      data-testid={`impact-row-${row.symbol}`}
                    >
                      <td className="py-3 pr-3 font-mono text-xs font-semibold">
                        {row.symbol}
                      </td>
                      {row.cells.map((cell) => {
                        const key = `${row.symbol}|${cell.horizon}`;
                        const median = cell.stats?.median ?? null;
                        const n = cell.stats?.n ?? 0;
                        const strength = impactIntensity(
                          median,
                          columnMax[cell.horizon] ?? 0,
                        );
                        const tint =
                          median == null || median === 0
                            ? "transparent"
                            : `color-mix(in srgb, var(${median > 0 ? "--positive" : "--negative"}) ${Math.round(strength * 22)}%, transparent)`;
                        return (
                          <td key={cell.horizon} className="p-1 align-top">
                            <button
                              type="button"
                              className={`impact-cell${n > 0 && n < SMALL_SAMPLE ? " impact-cell-thin" : ""}`}
                              style={{ background: tint }}
                              aria-pressed={focusCell === key}
                              data-testid={`impact-cell-${row.symbol}-${cell.horizon}`}
                              onPointerEnter={() => setFocusCell(key)}
                              onFocus={() => setFocusCell(key)}
                              onClick={() => setFocusCell(key)}
                            >
                              <span
                                className={`block font-mono text-xs ${
                                  (median ?? 0) > 0
                                    ? "text-[var(--positive)]"
                                    : (median ?? 0) < 0
                                      ? "text-[var(--negative)]"
                                      : ""
                                }`}
                              >
                                {pct(median)}
                              </span>
                              <span className="mt-1 block font-mono text-[10px] text-[var(--muted)]">
                                up {hitPct(cell.stats?.hitRateUp ?? null)} · n=
                                {n}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p
              className="impact-readout"
              aria-live="polite"
              data-testid="impact-readout"
            >
              {focused ??
                `Hover or tap a cell to read it in plain words. Stronger colour means a bigger typical move for that horizon; faded cells have fewer than ${SMALL_SAMPLE} releases.`}
            </p>

            <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
              {report.disclaimer}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              Tone filter: <EconomicTerm term="hawkish">hawkish</EconomicTerm>{" "}
              usually points toward higher rates;{" "}
              <EconomicTerm term="dovish">dovish</EconomicTerm> usually points
              toward lower rates.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
