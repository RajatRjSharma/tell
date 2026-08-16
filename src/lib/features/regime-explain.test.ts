import { describe, expect, it } from "vitest";
import { classifyUsRegime } from "@/lib/features/regime";
import {
  explainUsRegime,
  plainRegimeLabel,
} from "@/lib/features/regime-explain";

describe("explainUsRegime", () => {
  it("explains inflationary with CPI YoY input card", () => {
    const result = classifyUsRegime("2026-08-01", {
      cpiYoy: 0.04,
      indproYoy: 0.01,
      fedFunds: 4.3,
      curveSpread: 0.4,
      vix: 14,
    });
    const explainer = explainUsRegime(result);
    expect(explainer.plainLabel).toBe("Inflation pressure");
    expect(plainRegimeLabel("inflationary")).toBe("Inflation pressure");
    expect(explainer.reasons.some((r) => r.includes("CPI"))).toBe(true);
    const cpi = explainer.inputs.find((item) => item.id === "cpiYoy");
    expect(cpi?.valueLabel).toBe("4.0%");
    expect(cpi?.status).toBe("stress");
    expect(explainer.disclaimer.toLowerCase()).toContain("not a future");
  });

  it("lists all possible regime labels", () => {
    const result = classifyUsRegime("2026-08-01", {
      cpiYoy: 0.02,
      indproYoy: 0.02,
      fedFunds: 4,
      curveSpread: 0.3,
      vix: 14,
    });
    const explainer = explainUsRegime(result);
    expect(explainer.possibleValues.map((item) => item.id)).toEqual([
      "risk_off",
      "inflationary",
      "slowdown",
      "expansion",
      "neutral",
    ]);
  });
});
