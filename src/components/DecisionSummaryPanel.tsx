"use client";

import { EconomicTerm } from "@/components/EconomicTerm";
import type { DecisionSummary } from "@/lib/decision/summary";

function leanClass(lean: DecisionSummary["lean"]): string {
  if (lean === "up") return "text-[var(--positive)]";
  if (lean === "down") return "text-[var(--negative)]";
  return "text-[var(--muted-strong)]";
}

function leanWord(lean: DecisionSummary["lean"]): string {
  if (lean === "up") return "Lean up";
  if (lean === "down") return "Lean down";
  if (lean === "unclear") return "Unclear";
  return "Mixed";
}

export function DecisionSummaryPanel({
  summary,
}: {
  summary: DecisionSummary;
}) {
  return (
    <section
      className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
      data-testid="decision-summary"
      aria-label="What this means"
    >
      <div className="border-b border-[var(--line)] px-5 py-4 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
          What this means
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="max-w-3xl text-balance text-xl font-semibold tracking-[-0.035em] sm:text-2xl">
            {summary.headline}
          </h2>
          <span
            className={`font-mono text-sm font-semibold uppercase tracking-[0.06em] ${leanClass(summary.lean)}`}
          >
            {leanWord(summary.lean)}
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted-strong)]">
          {summary.what}
        </p>
      </div>

      <div className="grid gap-px bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-[var(--surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Where
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            {summary.where}
          </p>
        </div>
        <div className="bg-[var(--surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            When
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            {summary.when}
          </p>
        </div>
        <div className="bg-[var(--surface)] p-4 sm:p-5 sm:col-span-2 lg:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            How strong
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-strong)]">
            {summary.howStrong}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">
            <EconomicTerm term="confidence">Evidence strength</EconomicTerm>{" "}
            {summary.evidenceNote}
          </p>
        </div>
      </div>

      <div className="grid gap-px border-t border-[var(--line)] bg-[var(--line)] lg:grid-cols-2">
        <div className="bg-[var(--surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Why it leans this way
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-strong)]">
            {summary.whySupport.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[var(--surface)] p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            What argues the other way
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--muted-strong)]">
            {summary.whyAgainst.map((item) => (
              <li key={item} className="break-words">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-5 py-4 sm:px-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          What could change this
        </h3>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-[var(--muted-strong)] sm:grid-cols-3">
          {summary.whatCouldChange.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
          {summary.disclaimer} Model {summary.modelVersion}. Average score{" "}
          {summary.averageScore >= 0 ? "+" : ""}
          {summary.averageScore.toFixed(2)} · {summary.counts.bullish}↑ ·{" "}
          {summary.counts.neutral}→ · {summary.counts.bearish}↓
        </p>
      </div>
    </section>
  );
}
