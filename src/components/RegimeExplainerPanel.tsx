"use client";

import { useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";
import type { RegimeExplainer } from "@/lib/features/regime-explain";

function statusClass(status: string): string {
  if (status === "stress") return "text-[var(--negative)]";
  if (status === "watch") return "text-[var(--muted-strong)]";
  if (status === "missing") return "text-[var(--muted)]";
  return "text-[var(--positive)]";
}

export function RegimeExplainerPanel({
  explainer,
}: {
  explainer: RegimeExplainer | null;
}) {
  const [open, setOpen] = useState(false);

  if (!explainer) return null;

  return (
    <section
      className="mt-6 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
      data-testid="regime-explainer"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0 max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
            Current condition · {explainer.scopeLabel}
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.03em]">
            <EconomicTerm term="regime">{explainer.plainLabel}</EconomicTerm>
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            {explainer.meaning}
          </p>
          <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
            as of {explainer.asOf}
          </p>
        </div>
        <button
          type="button"
          className="button-secondary text-xs"
          data-testid="regime-explainer-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide details" : "Why this label"}
        </button>
      </div>

      {open ? (
        <div className="border-t border-[var(--line)] px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Why Tell says this
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-strong)]">
            {explainer.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Backend inputs
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {explainer.inputs.map((input) => (
              <div
                key={input.id}
                className="rounded-[12px] border border-[var(--line)] p-3"
                data-testid={`regime-input-${input.id}`}
              >
                <p className="text-xs text-[var(--muted)]">{input.label}</p>
                <p
                  className={`mt-1 font-mono text-lg tracking-[-0.04em] ${statusClass(input.status)}`}
                >
                  {input.valueLabel}
                </p>
                <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                  {input.thresholdLabel}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[var(--muted-strong)]">
                  {input.note}
                </p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Usual asset-class tilt
          </h3>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--muted-strong)] sm:grid-cols-3">
            {explainer.assetClassHints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>

          <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Possible labels
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-strong)]">
            {explainer.possibleValues.map((item) => (
              <li key={item.id}>
                <strong className="text-[var(--text)]">{item.label}</strong>
                {" — "}
                {item.when}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
            {explainer.disclaimer}
          </p>
        </div>
      ) : null}
    </section>
  );
}
