"use client";

import { useEffect, useState } from "react";
import { EconomicTerm, type EconomicTermKey } from "@/components/EconomicTerm";
import type { NearTermBias } from "@/lib/risk/near-term";

type State = {
  key: string;
  status: "ready" | "error";
  bias: NearTermBias | null;
  error: string | null;
};

function BiasPill({ label }: { label: "risk-on" | "mixed" | "risk-off" }) {
  const color =
    label === "risk-on"
      ? "text-[var(--positive)] bg-[var(--positive-soft)]"
      : label === "risk-off"
        ? "text-[var(--negative)] bg-[var(--negative-soft)]"
        : "text-[var(--muted-strong)] bg-[var(--page)]";

  return (
    <span
      className={`inline-flex rounded-[8px] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${color}`}
    >
      <EconomicTerm
        term={
          (
            {
              "risk-on": "riskOn",
              mixed: "mixed",
              "risk-off": "riskOff",
            } as const
          )[label] satisfies EconomicTermKey
        }
      >
        {label}
      </EconomicTerm>
    </span>
  );
}

export function NearTermBiasPanel({
  initialBias = null,
  symbols,
  scopeLabel,
}: {
  initialBias?: NearTermBias | null;
  symbols?: string[];
  scopeLabel: string;
}) {
  const isUnfilteredWorld = symbols === undefined;
  const symbolKey = [...new Set(symbols ?? [])].sort().join(",");
  const requestKey = isUnfilteredWorld ? "world" : symbolKey || "empty";
  const [results, setResults] = useState<Record<string, State>>(() => {
    const initialResults: Record<string, State> = {};
    if (initialBias) {
      initialResults.world = {
        key: "world",
        status: "ready",
        bias: initialBias,
        error: null,
      };
    }
    return initialResults;
  });
  const active = results[requestKey] ?? null;

  useEffect(() => {
    if (requestKey === "empty" || (requestKey === "world" && initialBias))
      return;

    let cancelled = false;
    const query = symbolKey ? `?symbols=${encodeURIComponent(symbolKey)}` : "";
    fetch(`/api/risk/near-term${query}`)
      .then(async (res) => {
        const data = (await res.json()) as NearTermBias & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setResults((current) => ({
            ...current,
            [requestKey]: {
              key: requestKey,
              status: "error",
              bias: null,
              error: data.error ?? "Failed to load near-term bias",
            },
          }));
          return;
        }
        setResults((current) => ({
          ...current,
          [requestKey]: {
            key: requestKey,
            status: "ready",
            bias: data,
            error: null,
          },
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setResults((current) => ({
            ...current,
            [requestKey]: {
              key: requestKey,
              status: "error",
              bias: null,
              error: "Failed to load near-term bias",
            },
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialBias, requestKey, symbolKey]);

  const bias = active?.bias ?? null;

  return (
    <section
      className="mt-10 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
      data-testid="near-term-bias"
      aria-label="Next trading session bias"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
            {scopeLabel} snapshot
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
            Next session bias
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Average of the latest 1-day scores across {scopeLabel}. The
            follow-on estimate is only a softer carry of that average — not an
            independent tomorrow forecast.
          </p>
        </div>
        {bias?.asOf ? (
          <p className="font-mono text-[11px] text-[var(--muted)]">
            as of {bias.asOf} · n={bias.sampleSize} assets
          </p>
        ) : null}
      </div>

      {active?.status === "error" ? (
        <p className="mt-5 text-sm text-[var(--negative)]">{active.error}</p>
      ) : requestKey === "empty" ? (
        <p className="mt-5 text-sm text-[var(--muted)]">
          No markets match this geography and market filter.
        </p>
      ) : !bias ? (
        <p className="mt-5 text-sm text-[var(--muted)]">Loading bias…</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Latest 1d average</span>
              <BiasPill label={bias.today.label} />
            </div>
            <p className="mt-3 font-mono text-2xl tracking-[-0.04em]">
              {bias.today.score >= 0 ? "+" : ""}
              {bias.today.score.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              <EconomicTerm term="signalScore">
                Average signal score
              </EconomicTerm>
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              {bias.today.note}
            </p>
            <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
              {bias.today.bullish}↑ bullish · {bias.today.neutral}→ neutral ·{" "}
              {bias.today.bearish}↓ bearish
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Softer follow-on</span>
              <BiasPill label={bias.tomorrow.label} />
            </div>
            <p className="mt-3 font-mono text-2xl tracking-[-0.04em]">
              {bias.tomorrow.score >= 0 ? "+" : ""}
              {bias.tomorrow.score.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              65% of the latest 1d average (carry, not a new model)
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              {bias.tomorrow.note}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
