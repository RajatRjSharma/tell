import type { Client } from "@libsql/client";

export type PolicyEvent = {
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
  createdAt: string;
};

export type EventUpsert = {
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

function parseAssetsImpact(raw: unknown): string[] {
  if (raw == null) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function rowToPolicyEvent(row: Record<string, unknown>): PolicyEvent {
  return {
    id: String(row.id),
    date: String(row.date),
    countryCode: row.country_code == null ? null : String(row.country_code),
    type: row.type == null ? null : String(row.type),
    title: String(row.title),
    summary: row.summary == null ? null : String(row.summary),
    url: row.url == null ? null : String(row.url),
    sentiment: row.sentiment == null ? null : Number(row.sentiment),
    assetsImpact: parseAssetsImpact(row.assets_impact_json),
    source: row.source == null ? null : String(row.source),
    createdAt: String(row.created_at),
  };
}

export async function upsertEvents(
  db: Client,
  rows: EventUpsert[],
): Promise<number> {
  let written = 0;
  for (const row of rows) {
    await db.execute({
      sql: `INSERT INTO events (
              id, date, country_code, type, title, summary, url,
              sentiment, assets_impact_json, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              date = excluded.date,
              country_code = excluded.country_code,
              type = excluded.type,
              title = excluded.title,
              summary = excluded.summary,
              url = excluded.url,
              sentiment = excluded.sentiment,
              assets_impact_json = excluded.assets_impact_json,
              source = excluded.source`,
      args: [
        row.id,
        row.date,
        row.countryCode,
        row.type,
        row.title,
        row.summary,
        row.url,
        row.sentiment,
        JSON.stringify(row.assetsImpact),
        row.source,
      ],
    });
    written += 1;
    try {
      const { indexEventForRag } = await import("@/lib/ai/rag");
      await indexEventForRag(db, {
        id: row.id,
        title: row.title,
        summary: row.summary,
        source: row.source,
        date: row.date,
      });
    } catch {
      // FTS is best-effort — schema may not be migrated yet.
    }
  }
  return written;
}

export async function listEvents(
  db: Client,
  options?: {
    limit?: number;
    countryCode?: string | null;
    source?: string | null;
    since?: string | null;
    symbol?: string | null;
  },
): Promise<PolicyEvent[]> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const filters: string[] = [];
  const args: Array<string | number> = [];

  if (options?.countryCode) {
    filters.push("country_code = ?");
    args.push(options.countryCode);
  }
  if (options?.source) {
    filters.push("source = ?");
    args.push(options.source);
  }
  if (options?.since) {
    filters.push("date >= ?");
    args.push(options.since);
  }
  if (options?.symbol) {
    filters.push("assets_impact_json LIKE ?");
    args.push(`%"${options.symbol.toUpperCase()}"%`);
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  args.push(limit);

  const result = await db.execute({
    sql: `SELECT * FROM events
          ${where}
          ORDER BY date DESC, created_at DESC
          LIMIT ?`,
    args,
  });

  return result.rows.map((row) =>
    rowToPolicyEvent(row as Record<string, unknown>),
  );
}
