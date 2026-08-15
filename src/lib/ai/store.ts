import type { Client } from "@libsql/client";
import {
  AI_DISCLAIMER,
  type BriefDelta,
  type BriefResult,
} from "@/lib/ai/types";

/** Sentinel symbol for cross-asset market briefs. */
export const MARKET_BRIEF_SYMBOL = "_MARKET";

export type StoredBrief = BriefResult & {
  createdAt?: string;
};

export function briefStorageSymbol(symbol: string | null | undefined): string {
  const trimmed = symbol?.trim().toUpperCase();
  return trimmed && trimmed.length > 0 ? trimmed : MARKET_BRIEF_SYMBOL;
}

export function displayBriefSymbol(symbol: string): string | null {
  return symbol === MARKET_BRIEF_SYMBOL ? null : symbol;
}

function parseStringArray(raw: unknown): string[] {
  if (raw == null) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function rowToBrief(
  row: Record<string, unknown>,
  options?: { cached?: boolean },
): StoredBrief {
  return {
    title: String(row.title),
    summary: String(row.summary),
    bullets: parseStringArray(row.bullets_json),
    risks: parseStringArray(row.risks_json),
    model: String(row.model),
    provider: "gemini",
    asOf: row.as_of_date == null ? null : String(row.as_of_date),
    symbol: displayBriefSymbol(String(row.symbol)),
    horizon: String(row.horizon),
    cached: options?.cached ?? true,
    source: "database",
    disclaimer: AI_DISCLAIMER,
    createdAt: row.created_at == null ? undefined : String(row.created_at),
  };
}

export function diffBriefs(
  current: BriefResult,
  previous: BriefResult | null | undefined,
): BriefDelta | null {
  if (!previous) return null;
  return {
    previousAsOf: previous.asOf,
    titleChanged: current.title !== previous.title,
    summaryChanged: current.summary !== previous.summary,
    addedBullets: current.bullets
      .filter((bullet) => !previous.bullets.includes(bullet))
      .slice(0, 3),
    removedBullets: previous.bullets
      .filter((bullet) => !current.bullets.includes(bullet))
      .slice(0, 3),
  };
}

export async function upsertResearchBrief(
  db: Client,
  brief: BriefResult,
): Promise<void> {
  if (!brief.asOf) {
    throw new Error("Cannot persist brief without asOf date");
  }

  await db.execute({
    sql: `INSERT INTO research_briefs (
            symbol, horizon, as_of_date, title, summary,
            bullets_json, risks_json, model, provider
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(symbol, horizon, as_of_date, model)
          DO UPDATE SET
            title = excluded.title,
            summary = excluded.summary,
            bullets_json = excluded.bullets_json,
            risks_json = excluded.risks_json,
            provider = excluded.provider,
            created_at = datetime('now')`,
    args: [
      briefStorageSymbol(brief.symbol),
      brief.horizon,
      brief.asOf,
      brief.title,
      brief.summary,
      JSON.stringify(brief.bullets),
      JSON.stringify(brief.risks),
      brief.model,
      brief.provider,
    ],
  });
}

export async function listResearchBriefs(
  db: Client,
  options: {
    symbol?: string | null;
    horizon: string;
    limit?: number;
  },
): Promise<StoredBrief[]> {
  const limit = Math.min(Math.max(options.limit ?? 7, 1), 30);
  const result = await db.execute({
    sql: `SELECT symbol, horizon, as_of_date, title, summary,
                 bullets_json, risks_json, model, provider, created_at
          FROM research_briefs
          WHERE symbol = ? AND horizon = ?
          ORDER BY as_of_date DESC, created_at DESC
          LIMIT ?`,
    args: [briefStorageSymbol(options.symbol), options.horizon, limit],
  });

  return result.rows.map((row) =>
    rowToBrief(row as Record<string, unknown>, { cached: true }),
  );
}

export async function getLatestResearchBrief(
  db: Client,
  options: {
    symbol?: string | null;
    horizon: string;
    asOf?: string | null;
  },
): Promise<StoredBrief | null> {
  const args: Array<string | number> = [
    briefStorageSymbol(options.symbol),
    options.horizon,
  ];
  let sql = `SELECT symbol, horizon, as_of_date, title, summary,
                    bullets_json, risks_json, model, provider, created_at
             FROM research_briefs
             WHERE symbol = ? AND horizon = ?`;

  if (options.asOf) {
    sql += " AND as_of_date = ?";
    args.push(options.asOf);
  }

  sql += " ORDER BY as_of_date DESC, created_at DESC LIMIT 1";

  const result = await db.execute({ sql, args });
  const row = result.rows[0];
  if (!row) return null;
  return rowToBrief(row as Record<string, unknown>, { cached: true });
}
