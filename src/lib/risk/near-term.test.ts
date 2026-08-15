import { describe, expect, it, vi } from "vitest";
import { getNearTermRiskBias } from "@/lib/risk/near-term";

describe("getNearTermRiskBias", () => {
  it("labels risk-on when 1d ensemble is constructive", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ as_of: "2026-08-15" }],
      })
      .mockResolvedValueOnce({
        rows: [
          { direction: "bullish", score: 0.4, confidence: 0.7 },
          { direction: "bullish", score: 0.3, confidence: 0.6 },
          { direction: "neutral", score: 0.05, confidence: 0.5 },
        ],
      });

    const bias = await getNearTermRiskBias({ execute } as never);
    expect(bias.asOf).toBe("2026-08-15");
    expect(bias.today.label).toBe("risk-on");
    expect(bias.tomorrow.label).toBe("risk-on");
    expect(bias.sampleSize).toBe(3);
  });

  it("returns mixed empty state when no signals", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ as_of: null }] });
    const bias = await getNearTermRiskBias({ execute } as never);
    expect(bias.today.label).toBe("mixed");
    expect(bias.sampleSize).toBe(0);
  });
});
