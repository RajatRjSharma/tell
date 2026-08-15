import type { Client } from "@libsql/client";
import { CURRENT_VINTAGE } from "@/lib/readings";

export type ReadingDto = {
  countryCode: string;
  indicatorId: string;
  observedFor: string;
  value: number;
  source: string | null;
};

export async function listReadings(
  db: Client,
  options: {
    countryCode: string;
    indicatorId: string;
    from?: string | null;
    to?: string | null;
    limit: number;
  },
): Promise<ReadingDto[]> {
  const filters = ["country_code = ?", "indicator_id = ?", "vintage = ?"];
  const args: Array<string | number> = [
    options.countryCode,
    options.indicatorId,
    CURRENT_VINTAGE,
  ];

  if (options.from) {
    filters.push("observed_for >= ?");
    args.push(options.from);
  }
  if (options.to) {
    filters.push("observed_for <= ?");
    args.push(options.to);
  }

  args.push(options.limit);

  const result = await db.execute({
    sql: `SELECT country_code, indicator_id, observed_for, value, source
          FROM readings
          WHERE ${filters.join(" AND ")}
          ORDER BY observed_for DESC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) => ({
    countryCode: String(row.country_code),
    indicatorId: String(row.indicator_id),
    observedFor: String(row.observed_for),
    value: Number(row.value),
    source: row.source == null ? null : String(row.source),
  }));
}
