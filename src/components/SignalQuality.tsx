"use client";

import { useEffect, useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";

type QualityStats = {
  n: number;
  hits: number;
  hitRate: number | null;
};

type QualityPayload = {
  overall: QualityStats;
  byHorizon: Record<string, QualityStats>;
  bySymbol?: Record<string, QualityStats>;
  error?: string;
};

type QualityState = {
  key: string;
  status: "ready" | "error";
  payload: QualityPayload | null;
  error: string | null;
};

function pct(rate: number | null): string {
  if (rate == null) return "n/a";
  return `${Math.round(rate * 100)}%`;
}

export function SignalQuality({
  symbols,
  scopeLabel,
  horizon,
  enabled = true,
}: {
  symbols?: string[];
  scopeLabel: string;
  horizon: string;
  enabled?: boolean;
}) {
  const [result, setResult] = useState<QualityState | null>(null);
  const normalizedSymbols = [...new Set(symbols ?? [])].sort();
  const isEmptyScope = symbols !== undefined && normalizedSymbols.length === 0;
  const requestKey = isEmptyScope
    ? "empty"
    : normalizedSymbols.length === 0
      ? "all"
      : normalizedSymbols.join(",");
  const active = result?.key === requestKey ? result : null;
  const state = !enabled
    ? "auth"
    : isEmptyScope
      ? "empty"
      : active
        ? active.status
        : "loading";
  const payload = active?.payload ?? null;

  useEffect(() => {
    if (!enabled || isEmptyScope) return;
    const controller = new AbortController();
    const query =
      requestKey === "all" ? "" : `?symbols=${encodeURIComponent(requestKey)}`;

    fetch(`/api/quality${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as QualityPayload;
        if (!response.ok) {
          throw new Error(data.error ?? "Quality unavailable");
        }
        setResult({
          key: requestKey,
          status: "ready",
          payload: data,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          key: requestKey,
          status: "error",
          payload: null,
          error: err instanceof Error ? err.message : "Quality unavailable",
        });
      });

    return () => controller.abort();
  }, [requestKey, enabled, isEmptyScope]);

  const scoped =
    state === "ready" && payload
      ? (payload.byHorizon[horizon] ?? payload.overall)
      : null;

  return (
    <section className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            <EconomicTerm term="hitRate">Signal quality</EconomicTerm>
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Past forecast accuracy after each selected time period finishes.
            {` Scoped to ${scopeLabel}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-[8px] bg-[var(--surface-raised)] px-2 py-1 text-xs text-[var(--muted-strong)]"
            data-testid="quality-scope"
          >
            {scopeLabel}
          </span>
          <span className="font-mono text-[10px] text-[var(--muted)]">
            rules-v1 · {horizon}
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-3">
        {state === "auth" ? (
          <div className="metric-cell sm:col-span-3">
            <p className="text-sm text-[var(--muted)]">
              Sign in to load signal quality.
            </p>
          </div>
        ) : null}
        <div className="metric-cell">
          <span className="metric-label">
            <EconomicTerm term="hitRate" />
          </span>
          <strong className="metric-value">
            {state === "loading" || state === "auth"
              ? "…"
              : pct(scoped?.hitRate ?? null)}
          </strong>
          <span className="metric-note">
            {scoped ? `${scoped.hits}/${scoped.n} correct` : "awaiting eval"}
          </span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">
            <EconomicTerm term="evaluated" />
          </span>
          <strong className="metric-value">
            {state === "loading" ? "…" : (scoped?.n ?? 0)}
          </strong>
          <span className="metric-note">resolved forecasts</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">
            <EconomicTerm term="horizon">All time periods</EconomicTerm>
          </span>
          <strong className="metric-value">
            {state === "loading" ? "…" : pct(payload?.overall.hitRate ?? null)}
          </strong>
          <span className="metric-note">
            {payload ? `${payload.overall.n} total` : "n/a"}
          </span>
        </div>
      </div>

      {state === "error" ? (
        <p className="px-5 py-3 text-xs text-[var(--muted)]">
          {active?.error ?? "Quality unavailable. Run make compute-forecasts."}
        </p>
      ) : null}

      {state === "empty" ? (
        <p className="px-5 py-3 text-xs text-[var(--muted)]">
          No markets match this geography and market filter.
        </p>
      ) : null}

      {state === "ready" && scoped && scoped.n === 0 ? (
        <p className="px-5 py-3 text-xs text-[var(--muted)]">
          No resolved forecasts yet. After more market days, run{" "}
          <span className="font-mono">make compute-forecasts</span>.
        </p>
      ) : null}
    </section>
  );
}
