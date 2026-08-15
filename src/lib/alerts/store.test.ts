import { describe, expect, it } from "vitest";
import {
  createAlertRule,
  listAlertEvents,
  listAlertRules,
  markAlertEventsRead,
  rowToAlertRule,
} from "@/lib/alerts/store";

describe("rowToAlertRule", () => {
  it("maps sqlite row shapes", () => {
    const rule = rowToAlertRule({
      id: 3,
      user_id: "u1",
      symbol: "TLT",
      horizon: "1w",
      rule_type: "became_direction",
      rule_value: "bearish",
      enabled: 1,
      last_triggered_at: null,
      last_seen_direction: "neutral",
      last_seen_confidence: 0.4,
      last_seen_as_of: "2026-08-14",
      created_at: "2026-08-10T00:00:00Z",
    });

    expect(rule.enabled).toBe(true);
    expect(rule.ruleType).toBe("became_direction");
    expect(rule.ruleValue).toBe("bearish");
  });
});

describe("alert store queries", () => {
  it("creates rules and marks events read", async () => {
    const rules: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    let nextRuleId = 1;
    let nextEventId = 1;

    const db = {
      async execute(query: { sql: string; args?: unknown[] }) {
        const sql = query.sql.replace(/\s+/g, " ").trim();
        const args = query.args ?? [];

        if (sql.startsWith("INSERT INTO alert_rules")) {
          const row = {
            id: nextRuleId++,
            user_id: args[0],
            symbol: args[1],
            horizon: args[2],
            rule_type: args[3],
            rule_value: args[4],
            enabled: 1,
            last_triggered_at: null,
            last_seen_direction: null,
            last_seen_confidence: null,
            last_seen_as_of: null,
            created_at: "2026-08-15T00:00:00Z",
          };
          rules.push(row);
          return { rows: [row], rowsAffected: 1 };
        }

        if (sql.startsWith("SELECT * FROM alert_rules WHERE user_id")) {
          return {
            rows: rules.filter((row) => row.user_id === args[0]),
            rowsAffected: 0,
          };
        }

        if (sql.startsWith("SELECT * FROM alert_events WHERE user_id")) {
          return {
            rows: events
              .filter((row) => row.user_id === args[0])
              .slice(0, Number(args[1] ?? 30)),
            rowsAffected: 0,
          };
        }

        if (sql.startsWith("UPDATE alert_events SET read_at")) {
          let count = 0;
          for (const event of events) {
            if (event.user_id === args[0] && event.read_at == null) {
              event.read_at = "2026-08-15T01:00:00Z";
              count += 1;
            }
          }
          return { rows: [], rowsAffected: count };
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      },
    };

    const created = await createAlertRule(db as never, {
      userId: "u1",
      symbol: "SPY",
      horizon: "1d",
      ruleType: "direction_change",
      ruleValue: null,
    });
    expect(created.symbol).toBe("SPY");

    expect(await listAlertRules(db as never, "u1")).toHaveLength(1);

    events.push({
      id: nextEventId++,
      rule_id: created.id,
      user_id: "u1",
      symbol: "SPY",
      horizon: "1d",
      rule_type: "direction_change",
      title: "SPY flipped",
      body: "moved",
      signal_direction: "bearish",
      signal_confidence: 0.4,
      as_of_date: "2026-08-15",
      read_at: null,
      created_at: "2026-08-15T00:30:00Z",
    });

    expect(await listAlertEvents(db as never, "u1")).toHaveLength(1);
    expect(await markAlertEventsRead(db as never, "u1", { all: true })).toBe(1);
  });
});
