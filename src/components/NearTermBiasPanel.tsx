"use client";

import { useEffect, useState } from "react";
import type { NearTermBias } from "@/lib/risk/near-term";

type State = {
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
      {label}
    </span>
  );
}

export function NearTermBiasPanel({
  initialBias = null,
}: {
  initialBias?: NearTermBias | null;
}) {
  const [state, setState] = useState<State | null>(
    initialBias ? { status: "ready", bias: initialBias, error: null } : null,
  );

  useEffect(() => {
    if (initialBias) return;
    let cancelled = false;
    fetch("/api/risk/near-term")
      .then(async (res) => {
        const data = (await res.json()) as NearTermBias & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setState({
            status: "error",
            bias: null,
            error: data.error ?? "Failed to load near-term bias",
          });
          return;
        }
        setState({ status: "ready", bias: data, error: null });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
            bias: null,
            error: "Failed to load near-term bias",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialBias]);

  const bias = state?.bias ?? initialBias;

  return (
    <section
      className="mt-10 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
      data-testid="near-term-bias"
      aria-label="Today and tomorrow risk bias"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
            Near-term bias
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
            Today / tomorrow
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Ensemble of 1d outlooks across the asset universe. Tomorrow is a
            dampened carry-forward of today.
          </p>
        </div>
        {bias?.asOf ? (
          <p className="font-mono text-[11px] text-[var(--muted)]">
            as of {bias.asOf} · n={bias.sampleSize}
          </p>
        ) : null}
      </div>

      {state?.status === "error" ? (
        <p className="mt-5 text-sm text-[var(--negative)]">{state.error}</p>
      ) : !bias ? (
        <p className="mt-5 text-sm text-[var(--muted)]">Loading bias…</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Today</span>
              <BiasPill label={bias.today.label} />
            </div>
            <p className="mt-3 font-mono text-2xl tracking-[-0.04em]">
              {bias.today.score >= 0 ? "+" : ""}
              {bias.today.score.toFixed(2)}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
              {bias.today.note}
            </p>
            <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
              {bias.today.bullish}↑ · {bias.today.neutral}→ ·{" "}
              {bias.today.bearish}↓
            </p>
          </div>
          <div className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">Tomorrow</span>
              <BiasPill label={bias.tomorrow.label} />
            </div>
            <p className="mt-3 font-mono text-2xl tracking-[-0.04em]">
              {bias.tomorrow.score >= 0 ? "+" : ""}
              {bias.tomorrow.score.toFixed(2)}
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
