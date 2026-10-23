"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildSparklinePath,
  sparklinePoints,
  formatSparkDelta,
  formatSparkValue,
  type MacroSparkSeries,
  type MacroStrip,
} from "@/lib/macro/sparklines";
import { EconomicTerm, type EconomicTermKey } from "@/components/EconomicTerm";
import { useScrub } from "@/components/charts/useScrub";
import { explainMacroValue } from "@/lib/charts/explain";
import { formatChartDate } from "@/lib/charts/scrub";

type StripState = {
  status: "ready" | "error";
  strip: MacroStrip | null;
  error: string | null;
};

const WIDTH = 120;
const HEIGHT = 36;

function macroTerm(id: string): EconomicTermKey | null {
  if (id === "CPI") return "cpi";
  if (id === "T10Y2Y") return "yieldCurve";
  if (id === "VIXCLS" || id === "VIX") return "vix";
  return null;
}

function periodLabel(series: MacroSparkSeries): string {
  const count = series.points.length;
  if (series.periodKind === "monthly_readings" || series.id === "CPI") {
    return `${count} monthly reading${count === 1 ? "" : "s"}`;
  }
  return `${count} market session${count === 1 ? "" : "s"}`;
}

function unitHelp(series: MacroSparkSeries): string {
  if (series.id === "CPI") {
    return "CPI index level (not inflation %). Change is vs the prior month.";
  }
  if (series.id === "T10Y2Y") {
    return "10Y−2Y yield spread in percentage points. Change is vs the prior session.";
  }
  return "Expected US equity volatility. Change is vs the prior session.";
}

function MacroStripItem({ series }: { series: MacroSparkSeries }) {
  const values = useMemo(
    () => series.points.map((point) => point.value),
    [series.points],
  );
  const path = buildSparklinePath(values, WIDTH, HEIGHT);
  const coords = useMemo(
    () => sparklinePoints(values, WIDTH, HEIGHT),
    [values],
  );
  const xs = useMemo(() => coords.map((point) => point.x), [coords]);
  const scrub = useScrub(xs, WIDTH);
  const up = (series.rangeChange ?? 0) > 0;
  const down = (series.rangeChange ?? 0) < 0;

  const i = scrub.index;
  const shown = i != null ? series.points[i] : null;
  const prev = i != null && i > 0 ? series.points[i - 1] : null;
  const value = shown ? shown.value : series.latest;
  const delta = shown
    ? prev
      ? shown.value - prev.value
      : null
    : series.change;
  const asOf = shown ? shown.date : series.asOf;
  const previousValue = shown
    ? (prev?.value ?? null)
    : (series.points[series.points.length - 2]?.value ?? null);
  const meaning =
    value != null ? explainMacroValue(series.id, value, previousValue) : "";
  const granularity =
    series.periodKind === "monthly_readings" ? "month" : "day";

  return (
    <div className="macro-strip-item" data-testid={`macro-item-${series.id}`}>
      <div className="macro-strip-label">
        {macroTerm(series.id) ? (
          <EconomicTerm term={macroTerm(series.id)!}>
            {series.label}
          </EconomicTerm>
        ) : (
          series.label
        )}
      </div>

      <div className="macro-strip-reading">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <strong className="font-mono text-lg font-medium tracking-[-0.035em]">
              {formatSparkValue(value, series.unit)}
            </strong>
            <span
              className={`font-mono text-[10px] ${
                (delta ?? 0) > 0
                  ? "text-[var(--positive)]"
                  : (delta ?? 0) < 0
                    ? "text-[var(--negative)]"
                    : "text-[var(--muted)]"
              }`}
            >
              {formatSparkDelta(delta, series.unit)}
            </span>
          </div>
          {shown ? (
            <span
              className="font-mono text-[10px] text-[var(--accent)]"
              data-testid={`macro-scrub-${series.id}`}
            >
              {formatChartDate(shown.date, granularity)}
            </span>
          ) : null}
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width={WIDTH}
          height={HEIGHT}
          className="chart-scrub overflow-visible"
          role="img"
          aria-label={`${series.label} history. Use arrow keys to read each point.`}
          data-testid={`macro-spark-${series.id}`}
          {...scrub.svgProps}
        >
          <rect width={WIDTH} height={HEIGHT} fill="transparent" />
          {path ? (
            <path
              d={path}
              fill="none"
              stroke={
                up
                  ? "var(--positive)"
                  : down
                    ? "var(--negative)"
                    : "var(--muted-strong)"
              }
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {i != null && coords[i] ? (
            <g pointerEvents="none">
              <line
                x1={coords[i]!.x}
                x2={coords[i]!.x}
                y1={0}
                y2={HEIGHT}
                className="chart-crosshair"
              />
              <circle
                cx={coords[i]!.x}
                cy={coords[i]!.y}
                r="3"
                className="chart-focus-dot"
              />
            </g>
          ) : null}
        </svg>
      </div>

      {meaning ? (
        <p
          className="text-[11px] leading-4 text-[var(--muted-strong)]"
          data-testid={`macro-meaning-${series.id}`}
          aria-live="polite"
        >
          {meaning}
        </p>
      ) : null}

      {series.context ? (
        <p
          className="font-mono text-[11px] text-[var(--muted-strong)]"
          data-testid={`macro-context-${series.id}`}
        >
          {series.context.label}: {series.context.valueLabel}
        </p>
      ) : null}

      <div className="macro-strip-footer">
        <p className="font-mono text-[10px] text-[var(--muted)]">
          {asOf ?? "no data"} · US · {periodLabel(series)}
        </p>
        <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
          Hover or tap the line to read past values. {unitHelp(series)}
          {series.periodKind === "market_sessions" ? (
            <>
              {" "}
              <EconomicTerm term="sessions">Market sessions</EconomicTerm> skip
              weekends and holidays.
            </>
          ) : (
            <> Monthly readings are published roughly once a month.</>
          )}
        </p>
        {series.context ? (
          <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
            {series.context.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function MacroSparklineStrip({
  initialStrip = null,
}: {
  initialStrip?: MacroStrip | null;
}) {
  const [result, setResult] = useState<StripState | null>(
    initialStrip ? { status: "ready", strip: initialStrip, error: null } : null,
  );
  const state = result?.status ?? (initialStrip ? "ready" : "loading");
  const strip = result?.strip ?? initialStrip;

  useEffect(() => {
    if (initialStrip) return;
    const controller = new AbortController();

    fetch("/api/macro/strip?limit=24", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as {
          strip?: MacroStrip;
          error?: string;
        };
        if (!response.ok || !data.strip) {
          throw new Error(data.error ?? "Macro strip unavailable");
        }
        setResult({ status: "ready", strip: data.strip, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          status: "error",
          strip: null,
          error: err instanceof Error ? err.message : "Macro strip unavailable",
        });
      });

    return () => controller.abort();
  }, [initialStrip]);

  if (state === "error") {
    return (
      <section
        className="mt-8 text-xs text-[var(--muted)]"
        data-testid="macro-strip"
      >
        Macro strip unavailable.
      </section>
    );
  }

  if (!strip) {
    return (
      <section
        className="mt-8 text-xs text-[var(--muted)]"
        data-testid="macro-strip"
      >
        Loading macro…
      </section>
    );
  }

  return (
    <section
      className="macro-strip mt-8"
      data-testid="macro-strip"
      aria-label="US macro sparkline strip"
    >
      {strip.series.map((series) => (
        <MacroStripItem key={series.id} series={series} />
      ))}
    </section>
  );
}
