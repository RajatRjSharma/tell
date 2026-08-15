"use client";

import { useEffect, useState } from "react";

type BriefPayload = {
  title: string;
  summary: string;
  bullets: string[];
  risks: string[];
  model: string;
  asOf: string | null;
  cached: boolean;
  source?: "memory" | "database" | "live";
  disclaimer: string;
  previous: {
    title: string;
    summary: string;
    asOf: string | null;
  } | null;
  delta: {
    previousAsOf: string | null;
    titleChanged: boolean;
    summaryChanged: boolean;
    addedBullets: string[];
    removedBullets: string[];
  } | null;
};

type BriefResultState = {
  key: string;
  refreshToken: number;
  status: "ready" | "error";
  brief: BriefPayload | null;
  error: string | null;
};

export function ResearchBrief({
  symbol,
  horizon,
  enabled = true,
}: {
  symbol: string;
  horizon: string;
  enabled?: boolean;
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<BriefResultState | null>(null);
  const requestKey = `${symbol}:${horizon}`;
  const active =
    result && result.key === requestKey && result.refreshToken === refreshToken
      ? result
      : null;
  const state = !enabled ? "auth" : active ? active.status : "loading";

  useEffect(() => {
    if (!enabled || !symbol) return;

    const controller = new AbortController();
    const refresh = refreshToken > 0 ? "&refresh=1" : "";

    fetch(
      `/api/brief?symbol=${encodeURIComponent(symbol)}&horizon=${encodeURIComponent(horizon)}${refresh}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const data = (await response.json()) as BriefPayload & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Brief unavailable");
        }
        setResult({
          key: requestKey,
          refreshToken,
          status: "ready",
          brief: data,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          key: requestKey,
          refreshToken,
          status: "error",
          brief: null,
          error: err instanceof Error ? err.message : "Brief unavailable",
        });
      });

    return () => controller.abort();
  }, [symbol, horizon, refreshToken, requestKey, enabled]);

  const delta = active?.brief?.delta ?? null;

  return (
    <section className="mt-6 border-t border-[var(--line)] pt-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
          Gemini brief
        </h4>
        <button
          type="button"
          className="font-mono text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--text)] disabled:opacity-40"
          disabled={!enabled}
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 min-h-28">
        {state === "auth" ? (
          <p className="text-sm text-[var(--muted)]">
            Sign in to load the research brief.
          </p>
        ) : null}

        {state === "loading" ? (
          <div className="space-y-2" aria-label="Loading brief">
            <div className="quote-skeleton w-full" />
            <div className="quote-skeleton w-[80%]" />
            <div className="quote-skeleton w-[60%]" />
          </div>
        ) : null}

        {state === "error" ? (
          <p className="text-sm text-[var(--muted)]">
            {active?.error ?? "Brief unavailable."}
          </p>
        ) : null}

        {state === "ready" && active?.brief ? (
          <div className="space-y-3">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium tracking-[-0.02em]">
                {active.brief.title}
              </p>
              <p className="mt-2 break-words text-xs leading-5 text-[var(--muted-strong)]">
                {active.brief.summary}
              </p>
            </div>

            {delta ? (
              <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  vs prior brief
                  {delta.previousAsOf ? ` · ${delta.previousAsOf}` : ""}
                </p>
                {!delta.titleChanged &&
                !delta.summaryChanged &&
                delta.addedBullets.length === 0 &&
                delta.removedBullets.length === 0 ? (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    No material change from the previous brief.
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {delta.summaryChanged ? (
                      <li className="text-xs text-[var(--muted-strong)]">
                        Summary updated
                      </li>
                    ) : null}
                    {delta.addedBullets.map((bullet) => (
                      <li
                        key={`add-${bullet}`}
                        className="text-xs text-[var(--positive)]"
                      >
                        + {bullet}
                      </li>
                    ))}
                    {delta.removedBullets.map((bullet) => (
                      <li
                        key={`rem-${bullet}`}
                        className="text-xs text-[var(--negative)]"
                      >
                        - {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                No prior brief yet for this view.
              </p>
            )}

            {active.brief.bullets.length > 0 ? (
              <ul className="space-y-2">
                {active.brief.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="grid grid-cols-[0.5rem_1fr] gap-2 text-xs leading-5 text-[var(--muted-strong)]"
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--accent)]" />
                    <span className="min-w-0 break-words">{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {active.brief.risks.length > 0 ? (
              <div>
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  Risks
                </p>
                <ul className="mt-2 space-y-1.5">
                  {active.brief.risks.map((risk) => (
                    <li
                      key={risk}
                      className="break-words text-xs leading-5 text-[var(--muted)]"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="break-all font-mono text-[10px] text-[var(--muted)]">
              {active.brief.model}
              {active.brief.source ? ` · ${active.brief.source}` : ""}
              {active.brief.cached ? " · cached" : ""}
              {active.brief.asOf ? ` · as of ${active.brief.asOf}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
