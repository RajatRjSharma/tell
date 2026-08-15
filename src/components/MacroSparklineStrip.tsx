"use client";

import { useEffect, useState } from "react";
import {
  buildSparklinePath,
  formatSparkDelta,
  formatSparkValue,
  type MacroSparkSeries,
  type MacroStrip,
} from "@/lib/macro/sparklines";
import { EconomicTerm, type EconomicTermKey } from "@/components/EconomicTerm";

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
  if (series.id === "CPI") {
    return `${count} monthly reading${count === 1 ? "" : "s"}`;
  }
  return `${count} market session${count === 1 ? "" : "s"}`;
}

function Sparkline({ series }: { series: MacroSparkSeries }) {
  const values = series.points.map((point) => point.value);
  const path = buildSparklinePath(values, WIDTH, HEIGHT);
  const up = (series.rangeChange ?? 0) > 0;
  const down = (series.rangeChange ?? 0) < 0;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="overflow-visible"
      aria-hidden="true"
    >
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
    </svg>
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
        <div key={series.id} className="macro-strip-item">
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
            <div className="flex items-baseline gap-2">
              <strong className="font-mono text-lg font-medium tracking-[-0.035em]">
                {formatSparkValue(series.latest, series.unit)}
              </strong>
              <span
                className={`font-mono text-[10px] ${
                  (series.change ?? 0) > 0
                    ? "text-[var(--positive)]"
                    : (series.change ?? 0) < 0
                      ? "text-[var(--negative)]"
                      : "text-[var(--muted)]"
                }`}
              >
                {formatSparkDelta(series.change, series.unit)}
              </span>
            </div>
            <Sparkline series={series} />
          </div>

          <div className="macro-strip-footer">
            <p className="font-mono text-[10px] text-[var(--muted)]">
              {series.asOf ?? "no data"} · US · {periodLabel(series)}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[var(--muted)]">
              Oldest value left, latest right. Change is from the prior reading.
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
