"use client";

import { useEffect, useState } from "react";

type QualityStats = {
  n: number;
  hits: number;
  hitRate: number | null;
};

type QualityPayload = {
  overall: QualityStats;
  byHorizon: Record<string, QualityStats>;
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
  symbol,
  horizon,
}: {
  symbol?: string;
  horizon: string;
}) {
  const [result, setResult] = useState<QualityState | null>(null);
  const requestKey = symbol?.trim().toUpperCase() || "all";
  const active = result?.key === requestKey ? result : null;
  const state = active ? active.status : "loading";
  const payload = active?.payload ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const query =
      requestKey === "all" ? "" : `?symbol=${encodeURIComponent(requestKey)}`;

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
  }, [requestKey]);

  const scoped =
    state === "ready" && payload
      ? (payload.byHorizon[horizon] ?? payload.overall)
      : null;

  return (
    <section className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            Signal quality
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Historical hit rate after each horizon resolves.
            {requestKey !== "all" ? ` Scoped to ${requestKey}.` : ""}
          </p>
        </div>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          rules-v1 · {horizon}
        </span>
      </div>

      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-3">
        <div className="metric-cell">
          <span className="metric-label">Hit rate</span>
          <strong className="metric-value">
            {state === "loading" ? "…" : pct(scoped?.hitRate ?? null)}
          </strong>
          <span className="metric-note">
            {scoped ? `${scoped.hits}/${scoped.n} correct` : "awaiting eval"}
          </span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">Evaluated</span>
          <strong className="metric-value">
            {state === "loading" ? "…" : (scoped?.n ?? 0)}
          </strong>
          <span className="metric-note">resolved forecasts</span>
        </div>
        <div className="metric-cell">
          <span className="metric-label">All horizons</span>
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

      {state === "ready" && scoped && scoped.n === 0 ? (
        <p className="px-5 py-3 text-xs text-[var(--muted)]">
          No resolved forecasts yet. After more market days, run{" "}
          <span className="font-mono">make compute-forecasts</span>.
        </p>
      ) : null}
    </section>
  );
}
