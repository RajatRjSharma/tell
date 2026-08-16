"use client";

import { useEffect, useState } from "react";

type PolicyEvent = {
  id: string;
  date: string;
  countryCode: string | null;
  type: string | null;
  title: string;
  summary: string | null;
  url: string | null;
  sentiment: number | null;
  assetsImpact: string[];
  source: string | null;
};

type EventsPayload = {
  events: PolicyEvent[];
  error?: string;
};

type EventsState = {
  key: string;
  status: "ready" | "error";
  payload: EventsPayload | null;
  error: string | null;
};

function sentimentLabel(value: number | null): string | null {
  if (value == null) return null;
  if (value > 0.1) return "hawkish tilt";
  if (value < -0.1) return "dovish tilt";
  return "mixed";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function uniqueSummary(title: string, summary: string | null): string | null {
  if (!summary) return null;
  if (normalizeText(title) === normalizeText(summary)) return null;
  return summary;
}

export function EventsPanel({
  symbol,
  countryCode,
  enabled = true,
}: {
  symbol?: string;
  countryCode?: string | null;
  enabled?: boolean;
}) {
  const [result, setResult] = useState<EventsState | null>(null);
  const requestKey = `${symbol ?? "all"}:${countryCode ?? "all"}`;
  const active = result?.key === requestKey ? result : null;
  const state = !enabled ? "auth" : active ? active.status : "loading";
  const events = active?.payload?.events ?? [];

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "12" });
    if (symbol) params.set("symbol", symbol);
    if (countryCode) params.set("country", countryCode);

    fetch(`/api/events?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as EventsPayload;
        if (!response.ok) {
          throw new Error(data.error ?? "Events unavailable");
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
          error: err instanceof Error ? err.message : "Events unavailable",
        });
      });

    return () => controller.abort();
  }, [requestKey, symbol, countryCode, enabled]);

  const visible = events.slice(0, 8);

  return (
    <section
      className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
      data-testid="events-panel"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">
            Policy events
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Fed, ECB, and BoE releases from free RSS feeds.
            {symbol
              ? ` Showing events tagged as relevant to ${symbol}${
                  countryCode ? ` / ${countryCode}` : ""
                }.`
              : " Showing the latest central-bank releases."}{" "}
            Tone tags are keyword-based, not asset-specific forecasts.
          </p>
        </div>
        <span className="font-mono text-[10px] text-[var(--muted)]">
          {state === "loading" ? "…" : `${visible.length} recent`}
        </span>
      </div>

      <div className="px-5 py-4">
        {state === "auth" ? (
          <p className="text-sm text-[var(--muted)]">
            Sign in to load policy events.
          </p>
        ) : state === "error" ? (
          <p className="text-sm text-[var(--negative)]">{active?.error}</p>
        ) : state === "loading" ? (
          <p className="text-sm text-[var(--muted)]">Loading events…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No tagged events for this scope yet. Try another asset, or run{" "}
            <code className="font-mono">make ingest-events</code>.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((event) => {
              const tone = sentimentLabel(event.sentiment);
              const summary = uniqueSummary(event.title, event.summary);
              const body = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                      {event.source ?? "source"} · {event.date}
                    </span>
                    {event.type ? (
                      <span className="rounded-[6px] bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-strong)]">
                        {event.type}
                      </span>
                    ) : null}
                    {tone ? (
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {tone}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-sm font-medium tracking-[-0.02em]">
                    {event.title}
                  </p>
                  {summary ? (
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-relaxed text-[var(--muted-strong)]">
                      {summary}
                    </p>
                  ) : null}
                  {event.assetsImpact.length > 0 ? (
                    <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                      Often watched with: {event.assetsImpact.join(", ")}
                    </p>
                  ) : null}
                </>
              );

              return (
                <li
                  key={event.id}
                  className="rounded-[12px] border border-[var(--line)] px-3 py-3"
                  data-testid={`event-${event.id}`}
                >
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block transition-opacity hover:opacity-80"
                    >
                      {body}
                    </a>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
