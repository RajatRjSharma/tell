import { horizonToBars } from "@/lib/signals/horizons";

export const MAP_PERIODS = ["1d", "1w", "1m"] as const;
export type MapPeriod = (typeof MAP_PERIODS)[number];
export type PeriodChanges = Record<MapPeriod, number | null>;

export const NO_CHANGES: PeriodChanges = { "1d": null, "1w": null, "1m": null };

/** Simple returns over the last 1, 5 and 21 bars of ascending closes. */
export function periodChanges(closes: readonly number[]): PeriodChanges {
  const last = closes.at(-1);
  const result: PeriodChanges = { ...NO_CHANGES };
  if (last == null) return result;
  for (const period of MAP_PERIODS) {
    const base = closes.at(-1 - horizonToBars(period));
    if (base != null && base > 0) result[period] = last / base - 1;
  }
  return result;
}

/** Size-weighted average change; tiles without a change are left out. */
export function weightedChanges(
  parts: ReadonlyArray<{ value: number; changes: PeriodChanges }>,
): PeriodChanges {
  const result: PeriodChanges = { ...NO_CHANGES };
  for (const period of MAP_PERIODS) {
    let weight = 0;
    let sum = 0;
    for (const part of parts) {
      const change = part.changes[period];
      if (change == null || part.value <= 0) continue;
      weight += part.value;
      sum += part.value * change;
    }
    if (weight > 0) result[period] = sum / weight;
  }
  return result;
}
