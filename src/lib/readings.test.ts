import { describe, expect, it } from "vitest";
import {
  CURRENT_VINTAGE,
  shouldReplaceReadingSource,
  toReadingUpserts,
} from "@/lib/readings";

describe("toReadingUpserts", () => {
  it("maps parsed rows to US FRED upsert shape", () => {
    const rows = toReadingUpserts("US", "CPI", "FRED", [
      { observedFor: "2024-01-01", value: 308.4 },
    ]);

    expect(rows).toEqual([
      {
        countryCode: "US",
        indicatorId: "CPI",
        observedFor: "2024-01-01",
        value: 308.4,
        source: "FRED",
        vintage: CURRENT_VINTAGE,
        releasedAt: null,
      },
    ]);
  });
});

describe("shouldReplaceReadingSource", () => {
  it("lets IMF overwrite anything and blocks World Bank from overwriting IMF", () => {
    expect(shouldReplaceReadingSource("WorldBank", "IMF")).toBe(true);
    expect(shouldReplaceReadingSource("IMF", "IMF")).toBe(true);
    expect(shouldReplaceReadingSource("IMF", "WorldBank")).toBe(false);
    expect(shouldReplaceReadingSource("WorldBank", "WorldBank")).toBe(true);
    expect(shouldReplaceReadingSource(null, "WorldBank")).toBe(true);
    expect(shouldReplaceReadingSource("FRED", "FRED")).toBe(true);
  });
});
