import { describe, expect, it } from "vitest";
import { zScoreTrailing } from "@/lib/features/stats";
import {
  drawdownFromHigh,
  realizedVol,
  simpleReturn,
} from "@/lib/features/returns";

function makeCloses(n: number, start = 100): { date: string; value: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    return {
      date: d.toISOString().slice(0, 10),
      value: start + i,
    };
  });
}

describe("zScoreTrailing", () => {
  it("returns null with short history and a finite score with enough points", () => {
    const short = makeCloses(2);
    expect(zScoreTrailing(short, short[1]!.date, 10)).toBeNull();

    const long = makeCloses(40);
    const asOf = long[long.length - 1]!.date;
    const z = zScoreTrailing(long, asOf, 20);
    expect(z).not.toBeNull();
    expect(Number.isFinite(z!)).toBe(true);
  });
});

describe("returns", () => {
  it("computes simple return and drawdown", () => {
    const closes = makeCloses(30);
    const asOf = closes[closes.length - 1]!.date;
    expect(simpleReturn(closes, asOf, 1)).toBeCloseTo(1 / (100 + 28));
    expect(drawdownFromHigh(closes, asOf, 10)).toBe(0); // at high
  });

  it("computes realized vol for varying returns", () => {
    const closes = [
      { date: "2024-01-01", value: 100 },
      { date: "2024-01-02", value: 102 },
      { date: "2024-01-03", value: 101 },
      { date: "2024-01-04", value: 103 },
      { date: "2024-01-05", value: 100 },
    ];
    const vol = realizedVol(closes, "2024-01-05", 4);
    expect(vol).not.toBeNull();
    expect(vol!).toBeGreaterThan(0);
  });
});
