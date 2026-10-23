"use client";

import { useMemo } from "react";
import { useScrub } from "@/components/charts/useScrub";
import { explainMacroValue } from "@/lib/charts/explain";
import type { LocalMacroPoint, LocalMacroRow } from "@/lib/macro/local";
import { buildSparklinePath, sparklinePoints } from "@/lib/macro/sparklines";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : isoDate;
}

function formatPp(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} pp`;
}

const SPARK_W = 96;
const SPARK_H = 24;

function Metric({
  label,
  indicatorId,
  point,
  testId,
}: {
  label: string;
  indicatorId: "CPI_YOY_M" | "POLICY_RATE";
  point: LocalMacroPoint | null;
  testId: string;
}) {
  const history = useMemo(() => point?.history ?? [], [point]);
  const values = useMemo(() => history.map((row) => row.value), [history]);
  const coords = useMemo(
    () => sparklinePoints(values, SPARK_W, SPARK_H),
    [values],
  );
  const xs = useMemo(() => coords.map((c) => c.x), [coords]);
  const scrub = useScrub(xs, SPARK_W);

  if (!point) {
    return (
      <div className="min-w-0" data-testid={testId}>
        <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
        <dd className="font-mono text-sm text-[var(--muted)]">n/a</dd>
      </div>
    );
  }

  const i = scrub.index;
  const shown = i != null ? history[i] : null;
  const value = shown?.value ?? point.value;
  const asOf = shown?.date ?? point.asOf;
  const previous =
    i != null
      ? (history[i - 1]?.value ?? null)
      : (history[history.length - 2]?.value ?? null);
  const meaning = explainMacroValue(indicatorId, value, previous);
  const path = buildSparklinePath(values, SPARK_W, SPARK_H);

  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd>
        <span className="font-mono text-lg tracking-[-0.03em]">
          {value.toFixed(2)}%
        </span>
        <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">
          <span className={shown ? "text-[var(--accent)]" : undefined}>
            {monthLabel(asOf)}
          </span>
          {!shown && point.change12m !== null
            ? ` · ${formatPp(point.change12m)} y/y`
            : ""}
        </span>
        {values.length > 1 ? (
          <svg
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
            className="chart-scrub mt-1.5 block h-6 w-full max-w-[6rem] overflow-visible"
            role="img"
            aria-label={`${label}, last ${values.length} months. Use arrow keys to read each month.`}
            data-testid={`${testId}-spark`}
            {...scrub.svgProps}
          >
            <rect width={SPARK_W} height={SPARK_H} fill="transparent" />
            <path
              d={path}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {i != null && coords[i] ? (
              <circle
                cx={coords[i]!.x}
                cy={coords[i]!.y}
                r="2.5"
                className="chart-focus-dot"
                pointerEvents="none"
              />
            ) : null}
          </svg>
        ) : null}
        {meaning ? (
          <span
            className="mt-1 block text-[10px] leading-4 text-[var(--muted-strong)]"
            aria-live="polite"
          >
            {meaning}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export function LocalMacroPanel({
  rows,
  countryNames,
  scopeLabel,
}: {
  rows: LocalMacroRow[];
  countryNames: Record<string, string>;
  scopeLabel: string;
}) {
  const hasData = rows.some((row) => row.inflation || row.policyRate);

  return (
    <section
      className="mt-10 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
      data-testid="local-macro"
      aria-label="Local inflation and policy rates"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
        {scopeLabel} macro
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
        Local inflation and policy rates
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Latest monthly headline inflation and central bank rate for each country
        in view. A positive real rate means policy is tighter than inflation.
      </p>

      {!hasData ? (
        <p className="mt-5 text-sm text-[var(--muted)]">
          No local macro loaded yet. Run the global macro ingest.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.countryCode}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4"
              data-testid={`local-macro-${row.countryCode}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {countryNames[row.countryCode] ?? row.countryCode}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {row.countryCode}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Metric
                  label="Inflation (YoY)"
                  indicatorId="CPI_YOY_M"
                  point={row.inflation}
                  testId={`local-inflation-${row.countryCode}`}
                />
                <Metric
                  label={row.countryCode === "DE" ? "ECB rate" : "Policy rate"}
                  indicatorId="POLICY_RATE"
                  point={row.policyRate}
                  testId={`local-policy-${row.countryCode}`}
                />
              </dl>
              {row.realRate !== null ? (
                <p className="mt-3 border-t border-[var(--line)] pt-2 font-mono text-[11px] text-[var(--muted-strong)]">
                  Real rate {formatPp(row.realRate)}
                  {row.realRate >= 0 ? " · tight" : " · loose"}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Sources: IMF Consumer Price Index (monthly) and BIS central bank policy
        rates. Germany shows the euro area ECB rate. Months can lag by one to
        three releases per country.
      </p>
    </section>
  );
}
