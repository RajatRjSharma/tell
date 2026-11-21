import type { MapPeriod } from "./changes";
import type { MapUnit } from "./views";

/** Move that saturates the colour scale; matches the signal momentum scales. */
export const PERIOD_SCALE: Record<MapPeriod, number> = {
  "1d": 0.03,
  "1w": 0.06,
  "1m": 0.1,
};

export const PERIOD_LABELS: Record<MapPeriod, string> = {
  "1d": "1 day",
  "1w": "1 week",
  "1m": "1 month",
};

/** −1…+1 colour intensity for a change over a period. */
export function changeIntensity(change: number | null, period: MapPeriod) {
  if (change == null || !Number.isFinite(change)) return null;
  return Math.max(-1, Math.min(1, change / PERIOD_SCALE[period]));
}

export function formatChange(change: number | null): string {
  if (change == null || !Number.isFinite(change)) return "n/a";
  const pct = change * 100;
  const digits = Math.abs(pct) >= 10 ? 1 : 2;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(digits)}%`;
}

export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(abs >= 1e13 ? 1 : 2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(abs >= 1e11 ? 0 : 1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

export function formatMapValue(value: number, unit: MapUnit): string | null {
  if (unit === "usd") return formatUsd(value);
  if (unit === "share") return `${(value * 100).toFixed(1)}% of S&P 500`;
  return null;
}

export function formatShare(part: number, whole: number): string | null {
  if (!(whole > 0)) return null;
  const pct = (part / whole) * 100;
  return `${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
}
