const DAY_MS = 86_400_000;

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Start date for an incremental pull: re-read `overlapDays` before the last
 * stored observation so provider revisions are picked up, but never earlier
 * than the configured full-history start.
 */
export function incrementalStart(
  latest: string | null,
  fallbackStart: string,
  overlapDays: number,
): string {
  if (!latest) return fallbackStart;
  const latestMs = Date.parse(`${latest.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(latestMs)) return fallbackStart;
  const start = isoDate(latestMs - overlapDays * DAY_MS);
  return start > fallbackStart ? start : fallbackStart;
}

export function fullRefreshRequested(): boolean {
  const raw = process.env.INGEST_FULL_REFRESH?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
