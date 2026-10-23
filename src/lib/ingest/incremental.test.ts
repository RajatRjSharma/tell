import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fullRefreshRequested,
  incrementalStart,
} from "@/lib/ingest/incremental";

describe("incrementalStart", () => {
  it("uses the fallback when nothing is stored", () => {
    expect(incrementalStart(null, "2015-01-01", 30)).toBe("2015-01-01");
  });

  it("rewinds by the overlap from the latest stored date", () => {
    expect(incrementalStart("2026-10-20", "2015-01-01", 14)).toBe("2026-10-06");
  });

  it("never goes earlier than the fallback start", () => {
    expect(incrementalStart("2015-02-01", "2015-01-01", 400)).toBe(
      "2015-01-01",
    );
  });

  it("ignores unparseable dates", () => {
    expect(incrementalStart("not-a-date", "2015-01-01", 14)).toBe("2015-01-01");
  });
});

describe("fullRefreshRequested", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads INGEST_FULL_REFRESH", () => {
    vi.stubEnv("INGEST_FULL_REFRESH", "true");
    expect(fullRefreshRequested()).toBe(true);
    vi.stubEnv("INGEST_FULL_REFRESH", "0");
    expect(fullRefreshRequested()).toBe(false);
  });
});
