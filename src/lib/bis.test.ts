import { describe, expect, it } from "vitest";
import { parseBisPolicyCsv } from "@/lib/bis";

const CSV = `FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE
M,US,2026-08,3.625
M,US,2026-07,3.875
M,XM,2026-08,2
M,IN,2026-08,
M,BR,2026-08,15`;

describe("parseBisPolicyCsv", () => {
  it("maps BIS areas to our countries, euro area to Germany", () => {
    const parsed = parseBisPolicyCsv(CSV, ["US", "DE", "IN"]);
    expect(parsed.US).toEqual([
      { observedFor: "2026-07-01", value: 3.875 },
      { observedFor: "2026-08-01", value: 3.625 },
    ]);
    expect(parsed.DE).toEqual([{ observedFor: "2026-08-01", value: 2 }]);
    expect(parsed).not.toHaveProperty("IN");
    expect(parsed).not.toHaveProperty("BR");
  });

  it("returns nothing for an unexpected header", () => {
    expect(parseBisPolicyCsv("A,B\n1,2", ["US"])).toEqual({});
  });
});
