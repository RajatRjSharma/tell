import type { Client } from "@libsql/client";
import {
  insertAlertEvent,
  listEnabledAlertRules,
  updateAlertRuleSeen,
} from "@/lib/alerts/store";
import type { AlertRule, AlertSignalSnapshot } from "@/lib/alerts/types";
import { appUrl } from "@/lib/config";
import { sendMail } from "@/lib/email/mailer";
import { alertEmailTemplate } from "@/lib/email/templates";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export function shouldFireAlert(
  rule: AlertRule,
  signal: AlertSignalSnapshot,
): boolean {
  if (rule.lastSeenAsOf === signal.asOfDate) {
    return false;
  }

  // New rule: set baseline, don't fire yet.
  if (rule.lastSeenAsOf == null) {
    return false;
  }

  switch (rule.ruleType) {
    case "direction_change":
      return (
        rule.lastSeenDirection != null &&
        rule.lastSeenDirection !== signal.direction
      );
    case "became_direction":
      return (
        rule.ruleValue != null &&
        signal.direction === rule.ruleValue &&
        rule.lastSeenDirection !== signal.direction
      );
    case "confidence_below": {
      const threshold = Number(rule.ruleValue);
      if (
        signal.confidence == null ||
        !Number.isFinite(threshold) ||
        threshold < 0 ||
        threshold > 1
      ) {
        return false;
      }
      const wasAtOrAbove =
        rule.lastSeenConfidence == null || rule.lastSeenConfidence >= threshold;
      return signal.confidence < threshold && wasAtOrAbove;
    }
    default:
      return false;
  }
}

export function buildAlertCopy(
  rule: AlertRule,
  signal: AlertSignalSnapshot,
): { title: string; body: string } {
  const conf =
    signal.confidence == null
      ? "n/a"
      : `${Math.round(signal.confidence * 100)}%`;

  switch (rule.ruleType) {
    case "direction_change":
      return {
        title: `${signal.symbol} ${signal.horizon} flipped to ${signal.direction}`,
        body: `Outlook moved from ${rule.lastSeenDirection ?? "unknown"} to ${signal.direction} (confidence ${conf}, as of ${signal.asOfDate}).`,
      };
    case "became_direction":
      return {
        title: `${signal.symbol} ${signal.horizon} became ${signal.direction}`,
        body: `Rule matched ${rule.ruleValue}. Confidence ${conf}, as of ${signal.asOfDate}.`,
      };
    case "confidence_below":
      return {
        title: `${signal.symbol} ${signal.horizon} confidence dropped`,
        body: `Confidence is ${conf}, below threshold ${Number(rule.ruleValue) * 100}% (direction ${signal.direction}, as of ${signal.asOfDate}).`,
      };
    default:
      return {
        title: `${signal.symbol} alert`,
        body: `Signal update as of ${signal.asOfDate}.`,
      };
  }
}

export async function loadLatestSignalSnapshot(
  db: Client,
  symbol: string,
  horizon: string,
  modelVersion = SIGNAL_MODEL_VERSION,
): Promise<AlertSignalSnapshot | null> {
  const result = await db.execute({
    sql: `SELECT symbol, horizon, as_of_date, direction, confidence, score
          FROM signals
          WHERE symbol = ?
            AND horizon = ?
            AND model_version = ?
          ORDER BY as_of_date DESC
          LIMIT 1`,
    args: [symbol, horizon, modelVersion],
  });

  const row = result.rows[0];
  if (!row) return null;

  return {
    symbol: String(row.symbol),
    horizon: String(row.horizon),
    asOfDate: String(row.as_of_date),
    direction: String(row.direction),
    confidence: row.confidence == null ? null : Number(row.confidence),
    score: row.score == null ? null : Number(row.score),
  };
}

async function loadUserEmail(
  db: Client,
  userId: string,
): Promise<string | null> {
  const result = await db.execute({
    sql: "SELECT email FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  const email = result.rows[0]?.email;
  return email == null ? null : String(email);
}

export type EvaluateAlertsResult = {
  considered: number;
  triggered: number;
  baselined: number;
  skipped: number;
  emailed: number;
};

export async function evaluateAlertRules(
  db: Client,
  options?: { modelVersion?: string; sendEmail?: boolean },
): Promise<EvaluateAlertsResult> {
  const modelVersion = options?.modelVersion ?? SIGNAL_MODEL_VERSION;
  const sendEmail = options?.sendEmail !== false;
  const rules = await listEnabledAlertRules(db);
  let triggered = 0;
  let baselined = 0;
  let skipped = 0;
  let emailed = 0;

  for (const rule of rules) {
    const signal = await loadLatestSignalSnapshot(
      db,
      rule.symbol,
      rule.horizon,
      modelVersion,
    );
    if (!signal) {
      skipped += 1;
      continue;
    }

    if (rule.lastSeenAsOf === signal.asOfDate) {
      skipped += 1;
      continue;
    }

    const fire = shouldFireAlert(rule, signal);
    if (fire) {
      const copy = buildAlertCopy(rule, signal);
      const inserted = await insertAlertEvent(db, {
        ruleId: rule.id,
        userId: rule.userId,
        symbol: signal.symbol,
        horizon: signal.horizon,
        ruleType: rule.ruleType,
        title: copy.title,
        body: copy.body,
        signalDirection: signal.direction,
        signalConfidence: signal.confidence,
        asOfDate: signal.asOfDate,
      });
      if (inserted) {
        triggered += 1;
        if (sendEmail) {
          const email = await loadUserEmail(db, rule.userId);
          if (email) {
            try {
              const template = alertEmailTemplate({
                title: copy.title,
                body: copy.body,
                symbol: signal.symbol,
                horizon: signal.horizon,
                asOfDate: signal.asOfDate,
                appUrl: appUrl(),
              });
              const result = await sendMail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
              });
              if (result.sent) emailed += 1;
            } catch (error) {
              console.warn("alert email failed", rule.id, error);
            }
          }
        }
      }
    } else if (rule.lastSeenAsOf == null) {
      baselined += 1;
    }

    await updateAlertRuleSeen(db, rule.id, {
      direction: signal.direction,
      confidence: signal.confidence,
      asOfDate: signal.asOfDate,
      triggered: fire,
    });
  }

  return {
    considered: rules.length,
    triggered,
    baselined,
    skipped,
    emailed,
  };
}
