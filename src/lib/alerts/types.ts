export const ALERT_RULE_TYPES = [
  "direction_change",
  "became_direction",
  "confidence_below",
] as const;

export type AlertRuleType = (typeof ALERT_RULE_TYPES)[number];

export const ALERT_DIRECTIONS = ["bullish", "neutral", "bearish"] as const;
export type AlertDirection = (typeof ALERT_DIRECTIONS)[number];

export type AlertRule = {
  id: number;
  userId: string;
  symbol: string;
  horizon: string;
  ruleType: AlertRuleType;
  ruleValue: string | null;
  enabled: boolean;
  lastTriggeredAt: string | null;
  lastSeenDirection: string | null;
  lastSeenConfidence: number | null;
  lastSeenAsOf: string | null;
  createdAt: string;
};

export type AlertEvent = {
  id: number;
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
  readAt: string | null;
  createdAt: string;
};

export type AlertSignalSnapshot = {
  symbol: string;
  horizon: string;
  asOfDate: string;
  direction: string;
  confidence: number | null;
  score: number | null;
};

export function isAlertRuleType(value: string): value is AlertRuleType {
  return (ALERT_RULE_TYPES as readonly string[]).includes(value);
}

export function isAlertDirection(value: string): value is AlertDirection {
  return (ALERT_DIRECTIONS as readonly string[]).includes(value);
}
