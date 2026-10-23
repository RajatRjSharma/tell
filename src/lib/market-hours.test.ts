import { describe, expect, it } from "vitest";
import { isUsMarketOpen } from "@/lib/market-hours";

describe("isUsMarketOpen", () => {
  it("is open 09:30–16:00 ET on weekdays, including across DST", () => {
    // EDT (UTC-4)
    expect(isUsMarketOpen(new Date("2026-10-21T13:30:00Z"))).toBe(true);
    expect(isUsMarketOpen(new Date("2026-10-21T13:29:00Z"))).toBe(false);
    expect(isUsMarketOpen(new Date("2026-10-21T19:59:00Z"))).toBe(true);
    expect(isUsMarketOpen(new Date("2026-10-21T20:00:00Z"))).toBe(false);
    // EST (UTC-5)
    expect(isUsMarketOpen(new Date("2026-12-02T14:30:00Z"))).toBe(true);
    expect(isUsMarketOpen(new Date("2026-12-02T14:29:00Z"))).toBe(false);
  });

  it("is closed on weekends", () => {
    expect(isUsMarketOpen(new Date("2026-10-24T15:00:00Z"))).toBe(false);
    expect(isUsMarketOpen(new Date("2026-10-25T15:00:00Z"))).toBe(false);
  });
});
