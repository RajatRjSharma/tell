import type { Client } from "@libsql/client";
import { generateBrief } from "@/lib/ai/brief";
import { sendMail } from "@/lib/email/mailer";
import { watchlistBriefEmailTemplate } from "@/lib/email/templates";
import { listWatchlist } from "@/lib/watchlist/store";
import type { BriefResult } from "@/lib/ai/types";

export type WatchlistBriefResult = {
  userId: string;
  email: string | null;
  symbols: string[];
  brief: BriefResult | null;
  emailed: boolean;
  skipped?: string;
};

async function listUsersWithWatchlists(
  db: Client,
): Promise<Array<{ userId: string; email: string }>> {
  const result = await db.execute({
    sql: `SELECT DISTINCT u.id AS user_id, u.email AS email
          FROM users u
          INNER JOIN watchlist_items w ON w.user_id = u.id
          ORDER BY u.email ASC`,
  });
  return result.rows.map((row) => ({
    userId: String(row.user_id),
    email: String(row.email),
  }));
}

/**
 * Build a Gemini brief from the user's starred symbols (uses first symbol as
 * focus when a single star; otherwise a market brief constrained in the prompt
 * via the primary symbol + email lists all).
 */
export async function generateWatchlistBriefForUser(
  db: Client,
  options: {
    userId: string;
    email?: string | null;
    horizon?: string;
    refresh?: boolean;
    sendEmail?: boolean;
  },
): Promise<WatchlistBriefResult> {
  const symbols = await listWatchlist(db, options.userId);
  if (symbols.length === 0) {
    return {
      userId: options.userId,
      email: options.email ?? null,
      symbols,
      brief: null,
      emailed: false,
      skipped: "empty watchlist",
    };
  }

  const focus = symbols[0] ?? null;
  const brief = await generateBrief(db, {
    symbol: symbols.length === 1 ? focus : null,
    horizon: options.horizon ?? "1d",
    refresh: options.refresh ?? true,
    persist: true,
  });

  // When multi-symbol, rewrite title/summary framing in email only.
  let emailed = false;
  if (options.sendEmail !== false && options.email) {
    const template = watchlistBriefEmailTemplate({
      asOf: brief.asOf,
      summary:
        symbols.length > 1
          ? `${brief.summary} Focus set: ${symbols.join(", ")}.`
          : brief.summary,
      bullets: brief.bullets,
      symbols,
      appUrl: process.env.APP_URL,
    });
    const result = await sendMail({
      to: options.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    emailed = result.sent;
  }

  return {
    userId: options.userId,
    email: options.email ?? null,
    symbols,
    brief,
    emailed,
  };
}

export async function computeWatchlistBriefs(
  db: Client,
  options?: { horizon?: string; sendEmail?: boolean },
): Promise<{ users: number; emailed: number; skipped: number }> {
  const users = await listUsersWithWatchlists(db);
  let emailed = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const result = await generateWatchlistBriefForUser(db, {
        userId: user.userId,
        email: user.email,
        horizon: options?.horizon ?? "1d",
        refresh: true,
        sendEmail: options?.sendEmail !== false,
      });
      if (result.skipped) skipped += 1;
      if (result.emailed) emailed += 1;
    } catch (error) {
      skipped += 1;
      console.warn("watchlist brief failed", user.userId, error);
    }
  }

  return { users: users.length, emailed, skipped };
}
