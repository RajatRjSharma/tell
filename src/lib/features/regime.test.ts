import { describe, expect, it } from "vitest";
import { classifyUsRegime } from "@/lib/features/regime";
import {
  computeMacroSeriesFeatures,
  defaultMacroOptions,
} from "@/lib/features/macro";
import { computeMarketFeatures } from "@/lib/features/market";

describe("classifyUsRegime", () => {
  it("flags risk_off on panic VIX", () => {
    const r = classifyUsRegime("2024-06-01", {
      cpiYoy: 0.02,
      indproYoy: 0.01,
      fedFunds: 5,
      curveSpread: 0.5,
      vix: 35,
    });
    expect(r.regime).toBe("risk_off");
  });

  it("flags inflationary on hot CPI", () => {
    const r = classifyUsRegime("2024-06-01", {
      cpiYoy: 0.05,
      indproYoy: 0.01,
      fedFunds: 5,
      curveSpread: 0.2,
      vix: 15,
    });
    expect(r.regime).toBe("inflationary");
  });

  it("flags slowdown on inverted curve", () => {
    const r = classifyUsRegime("2024-06-01", {
      cpiYoy: 0.02,
      indproYoy: 0.005,
      fedFunds: 5,
      curveSpread: -0.5,
      vix: 18,
    });
    expect(r.regime).toBe("slowdown");
  });

  it("flags expansion on solid growth and calm vol", () => {
    const r = classifyUsRegime("2024-06-01", {
      cpiYoy: 0.02,
      indproYoy: 0.02,
      fedFunds: 4,
      curveSpread: 0.3,
      vix: 14,
    });
    expect(r.regime).toBe("expansion");
  });
});

describe("macro and market feature snapshots", () => {
  it("computes macro features with defaults", () => {
    const points = Array.from({ length: 40 }, (_, i) => ({
      date: new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 10),
      value: 100 + i,
    }));
    const asOf = points[points.length - 1]!.date;
    const f = computeMacroSeriesFeatures(
      "CPI",
      points,
      asOf,
      defaultMacroOptions("CPI"),
    );
    expect(f.level).toBe(139);
    expect(f.changeLag).not.toBeNull();
    expect(f.zScore).not.toBeNull();
  });

  it("computes market features for a symbol", () => {
    const closes = Array.from({ length: 80 }, (_, i) => ({
      date: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      value: 400 + i,
    }));
    const asOf = closes[closes.length - 1]!.date;
    const m = computeMarketFeatures("SPY", closes, asOf);
    expect(m.symbol).toBe("SPY");
    expect(m.close).toBe(400 + 79);
    expect(m.return1d).not.toBeNull();
    expect(m.vol21d).not.toBeNull();
    expect(m.drawdown63d).toBe(0);
  });
});
