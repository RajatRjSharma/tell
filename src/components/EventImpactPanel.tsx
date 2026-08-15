"use client";

import { useEffect, useMemo, useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";

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
  symbol,
  enabled = true,
}: {
  symbol?: string;
  enabled?: boolean;
}) {
  const [sentiment, setSentiment] = useState<"any" | "hawkish" | "dovish">(
    "any",
  );
  const [result, setResult] = useState<ImpactState | null>(null);
  const requestKey = `${symbol ?? "market"}:${sentiment}`;
  const active = result?.key === requestKey ? result : null;
  const state = !enabled ? "auth" : active ? active.status : "loading";
  const report = active?.report ?? null;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      sentiment,
      horizons: "1d,1w,1m",
    });
    if (symbol) params.set("symbol", symbol);

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
  }, [requestKey, sentiment, symbol, enabled]);

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
            went up.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="impact-sentiment">
            Sentiment filter
          </label>
          <select
            id="impact-sentiment"
            className="select-control text-xs"
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
              {report.source} · {report.eventCount} events
              {report.oldestEvent && report.newestEvent
                ? ` · ${report.oldestEvent} → ${report.newestEvent}`
                : ""}
              {symbol ? ` · focused on ${symbol}` : ""}
            </p>

            <div className="mt-4 overflow-x-auto">
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
                      {row.cells.map((cell) => (
                        <td key={cell.horizon} className="px-2 py-3 align-top">
                          <div
                            className={`font-mono text-xs ${
                              (cell.stats?.median ?? 0) > 0
                                ? "text-[var(--positive)]"
                                : (cell.stats?.median ?? 0) < 0
                                  ? "text-[var(--negative)]"
                                  : ""
                            }`}
                          >
                            {pct(cell.stats?.median ?? null)}
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                            up {hitPct(cell.stats?.hitRateUp ?? null)} · n=
                            {cell.stats?.n ?? 0}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
