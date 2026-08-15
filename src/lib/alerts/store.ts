import type { Client } from "@libsql/client";
import type { AlertEvent, AlertRule, AlertRuleType } from "@/lib/alerts/types";
import { isAlertRuleType } from "@/lib/alerts/types";

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function rowToAlertRule(row: Record<string, unknown>): AlertRule {
  const ruleType = String(row.rule_type);
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    ruleType: isAlertRuleType(ruleType) ? ruleType : "direction_change",
    ruleValue: row.rule_value == null ? null : String(row.rule_value),
    enabled: Number(row.enabled) === 1,
    lastTriggeredAt:
      row.last_triggered_at == null ? null : String(row.last_triggered_at),
    lastSeenDirection:
      row.last_seen_direction == null ? null : String(row.last_seen_direction),
    lastSeenConfidence: numOrNull(row.last_seen_confidence),
    lastSeenAsOf:
      row.last_seen_as_of == null ? null : String(row.last_seen_as_of),
    createdAt: String(row.created_at),
  };
}

export function rowToAlertEvent(row: Record<string, unknown>): AlertEvent {
  const ruleType = String(row.rule_type);
  return {
    id: Number(row.id),
    ruleId: Number(row.rule_id),
    userId: String(row.user_id),
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    ruleType: isAlertRuleType(ruleType) ? ruleType : "direction_change",
    title: String(row.title),
    body: String(row.body),
    signalDirection:
      row.signal_direction == null ? null : String(row.signal_direction),
    signalConfidence: numOrNull(row.signal_confidence),
    asOfDate: String(row.as_of_date),
    readAt: row.read_at == null ? null : String(row.read_at),
    createdAt: String(row.created_at),
  };
}

export async function listAlertRules(
  db: Client,
  userId: string,
): Promise<AlertRule[]> {
  const result = await db.execute({
    sql: `SELECT * FROM alert_rules
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC`,
    args: [userId],
  });
  return result.rows.map((row) =>
    rowToAlertRule(row as Record<string, unknown>),
  );
}

export async function listEnabledAlertRules(db: Client): Promise<AlertRule[]> {
  const result = await db.execute({
    sql: `SELECT * FROM alert_rules
          WHERE enabled = 1
          ORDER BY id ASC`,
  });
  return result.rows.map((row) =>
    rowToAlertRule(row as Record<string, unknown>),
  );
}

export async function getAlertRule(
  db: Client,
  userId: string,
  ruleId: number,
): Promise<AlertRule | null> {
  const result = await db.execute({
    sql: `SELECT * FROM alert_rules WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [ruleId, userId],
  });
  const row = result.rows[0];
  return row ? rowToAlertRule(row as Record<string, unknown>) : null;
}

export async function createAlertRule(
  db: Client,
  input: {
    userId: string;
    symbol: string;
    horizon: string;
    ruleType: AlertRuleType;
    ruleValue: string | null;
  },
): Promise<AlertRule> {
  const result = await db.execute({
    sql: `INSERT INTO alert_rules (
            user_id, symbol, horizon, rule_type, rule_value, enabled
          ) VALUES (?, ?, ?, ?, ?, 1)
          RETURNING *`,
    args: [
      input.userId,
      input.symbol,
      input.horizon,
      input.ruleType,
      input.ruleValue,
    ],
  });

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to create alert rule");
  }
  return rowToAlertRule(row as Record<string, unknown>);
}

export async function setAlertRuleEnabled(
  db: Client,
  userId: string,
  ruleId: number,
  enabled: boolean,
): Promise<AlertRule | null> {
  await db.execute({
    sql: `UPDATE alert_rules
          SET enabled = ?
          WHERE id = ? AND user_id = ?`,
    args: [enabled ? 1 : 0, ruleId, userId],
  });
  return getAlertRule(db, userId, ruleId);
}

export async function deleteAlertRule(
  db: Client,
  userId: string,
  ruleId: number,
): Promise<boolean> {
  const result = await db.execute({
    sql: `DELETE FROM alert_rules WHERE id = ? AND user_id = ?`,
    args: [ruleId, userId],
  });
  return Number(result.rowsAffected ?? 0) > 0;
}

export async function updateAlertRuleSeen(
  db: Client,
  ruleId: number,
  seen: {
    direction: string;
    confidence: number | null;
    asOfDate: string;
    triggered: boolean;
  },
): Promise<void> {
  await db.execute({
    sql: `UPDATE alert_rules
          SET last_seen_direction = ?,
              last_seen_confidence = ?,
              last_seen_as_of = ?,
              last_triggered_at = CASE
                WHEN ? = 1 THEN datetime('now')
                ELSE last_triggered_at
              END
          WHERE id = ?`,
    args: [
      seen.direction,
      seen.confidence,
      seen.asOfDate,
      seen.triggered ? 1 : 0,
      ruleId,
    ],
  });
}

export async function insertAlertEvent(
  db: Client,
  input: {
    ruleId: number;
    userId: string;
    symbol: string;
    horizon: string;
    ruleType: AlertRuleType;
    title: string;
    body: string;
    signalDirection: string | null;
    signalConfidence: number | null;
    asOfDate: string;
  },
): Promise<boolean> {
  try {
    await db.execute({
      sql: `INSERT INTO alert_events (
              rule_id, user_id, symbol, horizon, rule_type,
              title, body, signal_direction, signal_confidence, as_of_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.ruleId,
        input.userId,
        input.symbol,
        input.horizon,
        input.ruleType,
        input.title,
        input.body,
        input.signalDirection,
        input.signalConfidence,
        input.asOfDate,
      ],
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE/i.test(message)) return false;
    throw error;
  }
}

export async function listAlertEvents(
  db: Client,
  userId: string,
  options?: { limit?: number; unreadOnly?: boolean },
): Promise<AlertEvent[]> {
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const args: Array<string | number> = [userId];
  let sql = `SELECT * FROM alert_events WHERE user_id = ?`;
  if (options?.unreadOnly) {
    sql += ` AND read_at IS NULL`;
  }
  sql += ` ORDER BY created_at DESC, id DESC LIMIT ?`;
  args.push(limit);

  const result = await db.execute({ sql, args });
  return result.rows.map((row) =>
    rowToAlertEvent(row as Record<string, unknown>),
  );
}

export async function countUnreadAlertEvents(
  db: Client,
  userId: string,
): Promise<number> {
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM alert_events
          WHERE user_id = ? AND read_at IS NULL`,
    args: [userId],
  });
  return Number(result.rows[0]?.n ?? 0);
}

export async function markAlertEventsRead(
  db: Client,
  userId: string,
  options: { eventIds?: number[]; all?: boolean },
): Promise<number> {
  if (options.all) {
    const result = await db.execute({
      sql: `UPDATE alert_events
            SET read_at = datetime('now')
            WHERE user_id = ? AND read_at IS NULL`,
      args: [userId],
    });
    return Number(result.rowsAffected ?? 0);
  }

  const ids = (options.eventIds ?? []).filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  if (ids.length === 0) return 0;

  const result = await db.execute({
    sql: `UPDATE alert_events
          SET read_at = datetime('now')
          WHERE user_id = ?
            AND read_at IS NULL
            AND id IN (${ids.map(() => "?").join(", ")})`,
    args: [userId, ...ids],
  });
  return Number(result.rowsAffected ?? 0);
}
