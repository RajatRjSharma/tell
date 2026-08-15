import type { Client } from "@libsql/client";
import type { ParsedReading } from "@/lib/fred";

export const CURRENT_VINTAGE = "current";

/** Prefer true IMF WEO over World Bank substitutes when both exist. */
export function shouldReplaceReadingSource(
  existingSource: string | null | undefined,
  incomingSource: string,
): boolean {
  if (incomingSource === "IMF") return true;
  if (existingSource === "IMF" && incomingSource === "WorldBank") return false;
  return true;
}

export type ReadingUpsert = {
  countryCode: string;
  indicatorId: string;
  observedFor: string;
  value: number;
  source: string;
  vintage?: string;
  releasedAt?: string | null;
};

export function toReadingUpserts(
  countryCode: string,
  indicatorId: string,
  source: string,
  parsed: ParsedReading[],
): ReadingUpsert[] {
  return parsed.map((row) => ({
    countryCode,
    indicatorId,
    observedFor: row.observedFor,
    value: row.value,
    source,
    vintage: CURRENT_VINTAGE,
  }));
}

/** Upsert readings in batches. Returns number of rows written. */
export async function upsertReadings(
  db: Client,
  rows: ReadingUpsert[],
  batchSize = 100,
): Promise<number> {
  if (rows.length === 0) return 0;

  let written = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");

    const args = batch.flatMap((row) => [
      row.countryCode,
      row.indicatorId,
      row.observedFor,
      row.value,
      row.releasedAt ?? null,
      row.vintage ?? CURRENT_VINTAGE,
      row.source,
    ]);

    // Do not let World Bank overwrite existing IMF WEO rows after a manual refresh.
    await db.execute({
      sql: `INSERT INTO readings (
              country_code, indicator_id, observed_for, value,
              released_at, vintage, source
            ) VALUES ${placeholders}
            ON CONFLICT(country_code, indicator_id, observed_for, vintage)
            DO UPDATE SET
              value = excluded.value,
              released_at = excluded.released_at,
              source = excluded.source,
              fetched_at = datetime('now')
            WHERE excluded.source = 'IMF'
               OR readings.source IS NULL
               OR readings.source != 'IMF'`,
      args,
    });

    written += batch.length;
  }

  return written;
}
