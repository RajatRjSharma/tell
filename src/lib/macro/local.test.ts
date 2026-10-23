import { describe, expect, it } from "vitest";
import { summarizeLocalMacro } from "@/lib/macro/local";

describe("summarizeLocalMacro", () => {
  it("takes the latest reading, 12-month change and real rate", () => {
    const rows = summarizeLocalMacro(
      [
        {
          countryCode: "IN",
          indicatorId: "CPI_YOY_M",
          observedFor: "2026-09-01",
          value: 4.4,
        },
        {
          countryCode: "IN",
          indicatorId: "CPI_YOY_M",
          observedFor: "2025-09-01",
          value: 5.4,
        },
        {
          countryCode: "IN",
          indicatorId: "POLICY_RATE",
          observedFor: "2026-08-01",
          value: 5.5,
        },
      ],
      ["IN", "JP"],
    );

    expect(rows[0]?.inflation).toEqual({
      value: 4.4,
      asOf: "2026-09-01",
      change12m: expect.closeTo(-1, 6),
    });
    expect(rows[0]?.policyRate).toEqual({
      value: 5.5,
      asOf: "2026-08-01",
      change12m: null,
    });
    expect(rows[0]?.realRate).toBeCloseTo(1.1, 6);
    expect(rows[1]).toEqual({
      countryCode: "JP",
      inflation: null,
      policyRate: null,
      realRate: null,
    });
  });
});
