"use client";

import { useEffect, useMemo, useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";
import {
  buildChartGeometry,
  type ChartBar,
  type ChartSignalMarker,
} from "@/lib/charts/geometry";

type ChartPayload = {
  symbol: string;
  from: string | null;
  to: string | null;
  bars: ChartBar[];
  signals: ChartSignalMarker[];
  changePct: number | null;
  error?: string;
};

type ChartState = {
  key: string;
  status: "ready" | "error";
  payload: ChartPayload | null;
  error: string | null;
};

const WIDTH = 640;
const HEIGHT = 180;

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString("en", { maximumFractionDigits: 1 });
  }
  return value.toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

export function PriceChart({
  symbol,
  horizon,
  enabled = true,
}: {
  symbol: string;
  horizon: string;
  enabled?: boolean;
}) {
  const [result, setResult] = useState<ChartState | null>(null);
  const requestKey = `${symbol}:${horizon}`;
  const active = result?.key === requestKey ? result : null;
  const state = !enabled ? "auth" : active ? active.status : "loading";
  const payload = active?.payload ?? null;

  useEffect(() => {
    if (!enabled || !symbol) return;
    const controller = new AbortController();

    fetch(
      `/api/charts/${encodeURIComponent(symbol)}?horizon=${encodeURIComponent(horizon)}&limit=90`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json()) as ChartPayload;
        if (!response.ok) {
          throw new Error(data.error ?? "Chart unavailable");
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
          error: err instanceof Error ? err.message : "Chart unavailable",
        });
      });

    return () => controller.abort();
  }, [symbol, horizon, requestKey, enabled]);

  const geometry = useMemo(
    () => buildChartGeometry(payload?.bars ?? [], WIDTH, HEIGHT),
    [payload],
  );

  const markers = useMemo(() => {
    const bars = payload?.bars ?? [];
    const signals = payload?.signals ?? [];
    if (bars.length === 0) return [];
    const byDate = new Map(geometry.points.map((point) => [point.date, point]));
    return signals
      .map((signal) => {
        const point = byDate.get(signal.date);
        if (!point) return null;
        return { ...signal, x: point.x, y: point.y };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [geometry.points, payload]);

  const change = payload?.changePct ?? null;

  return (
    <section className="mt-6 border-t border-[var(--line)] pt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
            Price
          </h4>
          <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
            {payload?.from && payload?.to
              ? `Daily closes: ${payload.from} → ${payload.to}`
              : "Daily closing prices"}
          </p>
        </div>
        {change != null ? (
          <span
            className={`font-mono text-xs ${
              change >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"
            }`}
          >
            {change >= 0 ? "+" : ""}
            {(change * 100).toFixed(2)}%
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {state === "auth" ? (
          <p className="text-sm text-[var(--muted)]">
            Sign in to load the price chart.
          </p>
        ) : null}

        {state === "loading" ? (
          <div className="chart-skeleton" aria-label="Loading chart" />
        ) : null}

        {state === "error" ? (
          <p className="text-sm text-[var(--muted)]">
            {active?.error ?? "Chart unavailable."}
          </p>
        ) : null}

        {state === "ready" && payload && payload.bars.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No price history for this symbol yet.
          </p>
        ) : null}

        {state === "ready" && payload && payload.bars.length > 0 ? (
          <div className="chart-frame">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full"
              role="img"
              aria-label={`${symbol} closing price chart`}
            >
              <defs>
                <linearGradient
                  id={`fill-${symbol}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity="0.28"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity="0.02"
                  />
                </linearGradient>
              </defs>

              <path
                d={geometry.areaPath}
                fill={`url(#fill-${symbol})`}
                className="chart-area"
              />
              <path
                d={geometry.linePath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                className="chart-line"
              />

              {markers.map((marker) => (
                <g key={`${marker.date}-${marker.horizon}`}>
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r="4.5"
                    className={`chart-marker chart-marker-${marker.direction}`}
                  />
                </g>
              ))}

              <text x="12" y="16" className="chart-label">
                {formatCompact(geometry.max)}
              </text>
              <text x="12" y={HEIGHT - 8} className="chart-label">
                {formatCompact(geometry.min)}
              </text>
            </svg>

            <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-[var(--muted)]">
              <span>
                <i className="chart-legend chart-legend-bullish" /> bullish
              </span>
              <span>
                <i className="chart-legend chart-legend-neutral" /> neutral
              </span>
              <span>
                <i className="chart-legend chart-legend-bearish" /> bearish
              </span>
              <span>
                <EconomicTerm term="sessions">
                  {payload.bars.length} sessions
                </EconomicTerm>
              </span>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">
              The line shows daily closing prices across the dates above. The
              percentage is the total price change over this displayed period.
              Dots mark earlier bullish, neutral, or bearish model signals.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
