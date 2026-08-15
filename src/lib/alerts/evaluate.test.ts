import { describe, expect, it } from "vitest";
import { buildAlertCopy, shouldFireAlert } from "@/lib/alerts/evaluate";
import type { AlertRule, AlertSignalSnapshot } from "@/lib/alerts/types";

function rule(overrides?: Partial<AlertRule>): AlertRule {
  return {
    id: 1,
    userId: "u1",
    symbol: "SPY",
    horizon: "1d",
    ruleType: "direction_change",
    ruleValue: null,
    enabled: true,
    lastTriggeredAt: null,
    lastSeenDirection: "bullish",
    lastSeenConfidence: 0.7,
    lastSeenAsOf: "2026-08-14",
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function signal(overrides?: Partial<AlertSignalSnapshot>): AlertSignalSnapshot {
  return {
    symbol: "SPY",
    horizon: "1d",
    asOfDate: "2026-08-15",
    direction: "bearish",
    confidence: 0.55,
    score: -0.3,
    ...overrides,
  };
}

describe("shouldFireAlert", () => {
  it("baselines without firing on first observation", () => {
    expect(
      shouldFireAlert(
        rule({ lastSeenAsOf: null, lastSeenDirection: null }),
        signal(),
      ),
    ).toBe(false);
  });

  it("skips same as_of", () => {
    expect(
      shouldFireAlert(rule({ lastSeenAsOf: "2026-08-15" }), signal()),
    ).toBe(false);
  });

  it("fires on direction change", () => {
    expect(shouldFireAlert(rule(), signal({ direction: "bearish" }))).toBe(
      true,
    );
    expect(shouldFireAlert(rule(), signal({ direction: "bullish" }))).toBe(
      false,
    );
  });

  it("fires when becoming a target direction", () => {
    expect(
      shouldFireAlert(
        rule({
          ruleType: "became_direction",
          ruleValue: "bearish",
          lastSeenDirection: "neutral",
        }),
        signal({ direction: "bearish" }),
      ),
    ).toBe(true);

    expect(
      shouldFireAlert(
        rule({
          ruleType: "became_direction",
          ruleValue: "bullish",
          lastSeenDirection: "neutral",
        }),
        signal({ direction: "bearish" }),
      ),
    ).toBe(false);
  });

  it("fires when confidence crosses below threshold", () => {
    expect(
      shouldFireAlert(
        rule({
          ruleType: "confidence_below",
          ruleValue: "0.5",
          lastSeenConfidence: 0.62,
        }),
        signal({ confidence: 0.4 }),
      ),
    ).toBe(true);

    expect(
      shouldFireAlert(
        rule({
          ruleType: "confidence_below",
          ruleValue: "0.5",
          lastSeenConfidence: 0.35,
        }),
        signal({ confidence: 0.4 }),
      ),
    ).toBe(false);
  });
});

describe("buildAlertCopy", () => {
  it("mentions previous direction on flip", () => {
    const copy = buildAlertCopy(rule(), signal());
    expect(copy.title).toContain("flipped");
    expect(copy.body).toContain("bullish");
    expect(copy.body).toContain("bearish");
  });
});
