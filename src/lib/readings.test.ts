import { describe, expect, it } from "vitest";
import { CURRENT_VINTAGE, toReadingUpserts } from "@/lib/readings";

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
      },
    ]);
  });
});
