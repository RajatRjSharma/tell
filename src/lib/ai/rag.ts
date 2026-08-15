import type { Client } from "@libsql/client";

export type ResearchFtsHit = {
  kind: string;
  refId: string;
  title: string;
  body: string;
  rank: number;
};

export async function upsertResearchFts(
  db: Client,
  row: {
    kind: string;
    refId: string;
    title: string;
    body: string;
  },
): Promise<void> {
  await db.execute({
    sql: `DELETE FROM research_fts WHERE kind = ? AND ref_id = ?`,
    args: [row.kind, row.refId],
  });
  await db.execute({
    sql: `INSERT INTO research_fts (kind, ref_id, title, body)
          VALUES (?, ?, ?, ?)`,
    args: [row.kind, row.refId, row.title, row.body],
  });
}

export async function searchResearchFts(
  db: Client,
  query: string,
  limit = 6,
): Promise<ResearchFtsHit[]> {
  const q = query.trim().replace(/["']/g, " ").slice(0, 200);
  if (!q) return [];

  const terms = q
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8)
    .map((term) => `"${term}"*`)
    .join(" OR ");

  if (!terms) return [];

  try {
    const result = await db.execute({
      sql: `SELECT kind, ref_id, title, body, rank
            FROM research_fts
            WHERE research_fts MATCH ?
            ORDER BY rank
            LIMIT ?`,
      args: [terms, limit],
    });

    return result.rows.map((row) => ({
      kind: String(row.kind),
      refId: String(row.ref_id),
      title: String(row.title),
      body: String(row.body),
      rank: Number(row.rank ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function indexEventForRag(
  db: Client,
  event: {
    id: number | string;
    title: string;
    summary?: string | null;
    source?: string | null;
    date: string;
  },
): Promise<void> {
  await upsertResearchFts(db, {
    kind: "event",
    refId: String(event.id),
    title: event.title,
    body: [event.date, event.source ?? "", event.title, event.summary ?? ""]
      .filter(Boolean)
      .join(" · "),
  });
}

export async function indexBriefForRag(
  db: Client,
  brief: {
    symbol: string | null;
    horizon: string;
    asOf: string | null;
    title: string;
    summary: string;
    bullets: string[];
  },
): Promise<void> {
  const refId = `${brief.symbol ?? "market"}:${brief.horizon}:${brief.asOf ?? "latest"}`;
  await upsertResearchFts(db, {
    kind: "brief",
    refId,
    title: brief.title,
    body: [brief.summary, ...brief.bullets].join(" "),
  });
}
