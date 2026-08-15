"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EconomicTerm } from "@/components/EconomicTerm";
import type { AlertEvent, AlertRule, AlertRuleType } from "@/lib/alerts/types";

type AlertsPayload = {
  rules: AlertRule[];
  events: AlertEvent[];
  unreadCount: number;
  error?: string;
};

type AlertsState = {
  key: string;
  status: "ready" | "error";
  payload: AlertsPayload | null;
  error: string | null;
};

function ruleLabel(rule: AlertRule): string {
  if (rule.ruleType === "direction_change") {
    return `${rule.symbol} ${rule.horizon} · any flip`;
  }
  if (rule.ruleType === "became_direction") {
    return `${rule.symbol} ${rule.horizon} · becomes ${rule.ruleValue}`;
  }
  return `${rule.symbol} ${rule.horizon} · conf < ${Math.round(Number(rule.ruleValue) * 100)}%`;
}

export function AlertsPanel({
  user,
  defaultSymbol,
  defaultHorizon,
  watchlist,
}: {
  user: { id: string; email: string; username?: string } | null;
  defaultSymbol: string;
  defaultHorizon: string;
  watchlist: string[];
}) {
  const [result, setResult] = useState<AlertsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState<AlertRuleType>("direction_change");
  const [direction, setDirection] = useState("bearish");
  const [confidence, setConfidence] = useState("0.4");
  const [symbolOverride, setSymbolOverride] = useState<string | null>(null);
  const [horizonOverride, setHorizonOverride] = useState<string | null>(null);

  const requestKey = user?.id ?? "guest";
  const active = result?.key === requestKey ? result : null;
  const state = user ? (active ? active.status : "loading") : "guest";
  const payload = active?.payload ?? null;

  const derivedSymbol = watchlist.includes(defaultSymbol)
    ? defaultSymbol
    : (watchlist[0] ?? "");
  const symbol =
    symbolOverride && watchlist.includes(symbolOverride)
      ? symbolOverride
      : derivedSymbol;
  const horizon = horizonOverride ?? defaultHorizon;

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    const key = user.id;
    fetch("/api/alerts", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as AlertsPayload;
        if (!response.ok) {
          throw new Error(data.error ?? "Alerts unavailable");
        }
        setResult({ key, status: "ready", payload: data, error: null });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          key,
          status: "error",
          payload: null,
          error: err instanceof Error ? err.message : "Alerts unavailable",
        });
      });

    return () => controller.abort();
  }, [user]);

  async function refresh() {
    if (!user) return;
    const response = await fetch("/api/alerts");
    const data = (await response.json()) as AlertsPayload;
    if (!response.ok) {
      throw new Error(data.error ?? "Alerts unavailable");
    }
    setResult({
      key: user.id,
      status: "ready",
      payload: data,
      error: null,
    });
  }

  async function createRule() {
    if (!user || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const body: Record<string, string> = {
        symbol,
        horizon,
        ruleType,
      };
      if (ruleType === "became_direction") body.ruleValue = direction;
      if (ruleType === "confidence_below") body.ruleValue = confidence;

      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create alert");
      }
      await refresh();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Could not create alert",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: AlertRule) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/alerts/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Update failed");
      }
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(ruleId: number) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Delete failed");
      }
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/alerts/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <section
        className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
        data-testid="alerts-panel"
      >
        <div className="px-5 py-5">
          <h2 className="text-sm font-semibold tracking-[-0.02em]">Alerts</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            <Link href="/login" className="underline underline-offset-2">
              Sign in
            </Link>{" "}
            to get notified when watchlist outlooks flip or confidence drops.
          </p>
        </div>
      </section>
    );
  }

  const symbolOptions =
    watchlist.length > 0 ? watchlist : defaultSymbol ? [defaultSymbol] : [];

  return (
    <section
      className="mt-10 overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)]"
      data-testid="alerts-panel"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em]">Alerts</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            In-app inbox for watchlist signal rules. Evaluated after daily
            signals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {payload && payload.unreadCount > 0 ? (
            <button
              type="button"
              className="button-secondary text-xs"
              data-testid="alerts-mark-read"
              onClick={() => void markAllRead()}
              disabled={busy}
            >
              Mark all read
            </button>
          ) : null}
          <span
            className="font-mono text-[10px] text-[var(--muted)]"
            data-testid="alerts-unread"
          >
            {state === "loading" ? "…" : `${payload?.unreadCount ?? 0} unread`}
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-[var(--line)] lg:grid-cols-2">
        <div className="bg-[var(--surface)] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Inbox
          </h3>
          {state === "error" ? (
            <p className="mt-3 text-sm text-[var(--negative)]">
              {active?.error}
            </p>
          ) : state === "loading" ? (
            <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
          ) : payload && payload.events.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {payload.events.slice(0, 8).map((event) => (
                <li
                  key={event.id}
                  className={`rounded-[12px] border border-[var(--line)] px-3 py-3 ${
                    event.readAt ? "opacity-70" : "bg-[var(--surface-raised)]"
                  }`}
                  data-testid={`alert-event-${event.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium tracking-[-0.02em]">
                      {event.title}
                    </p>
                    {!event.readAt ? (
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text)]" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-strong)]">
                    {event.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              No alerts yet. Create a rule, then wait for the next signal
              change.
            </p>
          )}
        </div>

        <div className="bg-[var(--surface)] p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Rules
          </h3>

          {watchlist.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              Star symbols on your watchlist before creating alert rules.
            </p>
          ) : (
            <div className="mt-3 space-y-3" data-testid="alerts-create-form">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-[var(--muted)]">
                  Symbol
                  <select
                    className="select-control mt-1 w-full"
                    value={symbol}
                    onChange={(event) => setSymbolOverride(event.target.value)}
                    data-testid="alerts-symbol"
                  >
                    {symbolOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  Forecast period
                  <select
                    className="select-control mt-1 w-full"
                    value={horizon}
                    onChange={(event) => setHorizonOverride(event.target.value)}
                    data-testid="alerts-horizon"
                  >
                    {["1d", "1w", "1m"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs text-[var(--muted)]">
                Rule
                <select
                  className="select-control mt-1 w-full"
                  value={ruleType}
                  onChange={(event) =>
                    setRuleType(event.target.value as AlertRuleType)
                  }
                  data-testid="alerts-rule-type"
                >
                  <option value="direction_change">Any direction flip</option>
                  <option value="became_direction">Became direction</option>
                  <option value="confidence_below">Confidence below</option>
                </select>
              </label>

              {ruleType === "became_direction" ? (
                <label className="block text-xs text-[var(--muted)]">
                  Target direction
                  <select
                    className="select-control mt-1 w-full"
                    value={direction}
                    onChange={(event) => setDirection(event.target.value)}
                    data-testid="alerts-direction"
                  >
                    <option value="bullish">Bullish</option>
                    <option value="neutral">Neutral</option>
                    <option value="bearish">Bearish</option>
                  </select>
                </label>
              ) : null}

              {ruleType === "confidence_below" ? (
                <label className="block text-xs text-[var(--muted)]">
                  Confidence threshold (0-1)
                  <input
                    className="select-control mt-1 w-full"
                    value={confidence}
                    onChange={(event) => setConfidence(event.target.value)}
                    data-testid="alerts-confidence"
                    inputMode="decimal"
                  />
                </label>
              ) : null}

              <p className="text-[11px] leading-5 text-[var(--muted)]">
                Help:{" "}
                <EconomicTerm term="horizon">forecast period</EconomicTerm>,{" "}
                <EconomicTerm term="confidence">confidence</EconomicTerm>,{" "}
                <EconomicTerm term="bullish">bullish</EconomicTerm>,{" "}
                <EconomicTerm term="neutral">neutral</EconomicTerm>,{" "}
                <EconomicTerm term="bearish">bearish</EconomicTerm>
              </p>

              <button
                type="button"
                className="button-primary w-full sm:w-auto"
                data-testid="alerts-create"
                disabled={busy || !symbol}
                onClick={() => void createRule()}
              >
                Add rule
              </button>
            </div>
          )}

          {formError ? (
            <p className="mt-3 text-sm text-[var(--negative)]" role="alert">
              {formError}
            </p>
          ) : null}

          {payload && payload.rules.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {payload.rules.map((rule) => (
                <li
                  key={rule.id}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--line)] px-3 py-2"
                  data-testid={`alert-rule-${rule.id}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {ruleLabel(rule)}
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">
                      {rule.enabled ? "Enabled" : "Paused"}
                      {rule.lastTriggeredAt
                        ? ` · last fire ${rule.lastTriggeredAt.slice(0, 10)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="button-secondary px-2 py-1 text-[11px]"
                      onClick={() => void toggleRule(rule)}
                      disabled={busy}
                    >
                      {rule.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      className="button-secondary px-2 py-1 text-[11px]"
                      onClick={() => void removeRule(rule.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
