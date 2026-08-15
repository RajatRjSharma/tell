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
  disclaimer: string;
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
}: {
  symbol: string;
  horizon: string;
}) {
  const [refreshToken, setRefreshToken] = useState(0);
  const [result, setResult] = useState<BriefResultState | null>(null);
  const requestKey = `${symbol}:${horizon}`;
  const active =
    result && result.key === requestKey && result.refreshToken === refreshToken
      ? result
      : null;
  const state = active ? active.status : "loading";

  useEffect(() => {
    if (!symbol) return;

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
  }, [symbol, horizon, refreshToken, requestKey]);

  return (
    <section className="mt-6 border-t border-[var(--line)] pt-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold text-[var(--muted-strong)]">
          Gemini brief
        </h4>
        <button
          type="button"
          className="font-mono text-[10px] text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          onClick={() => setRefreshToken((value) => value + 1)}
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 min-h-28">
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
            <div>
              <p className="text-sm font-medium tracking-[-0.02em]">
                {active.brief.title}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted-strong)]">
                {active.brief.summary}
              </p>
            </div>

            {active.brief.bullets.length > 0 ? (
              <ul className="space-y-2">
                {active.brief.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="grid grid-cols-[0.5rem_1fr] gap-2 text-xs leading-5 text-[var(--muted-strong)]"
                  >
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-[var(--accent)]" />
                    <span>{bullet}</span>
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
                      className="text-xs leading-5 text-[var(--muted)]"
                    >
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="font-mono text-[10px] text-[var(--muted)]">
              {active.brief.model}
              {active.brief.cached ? " · cached" : ""}
              {active.brief.asOf ? ` · as of ${active.brief.asOf}` : ""}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
