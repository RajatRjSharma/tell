import { describe, expect, it, vi } from "vitest";
import {
  aggregateStatus,
  buildHealthReport,
  checkApp,
  checkConfig,
  checkFinnhubQuote,
  checkYahooReachable,
  healthHttpStatus,
  type HealthCheck,
} from "@/lib/api/health";

describe("checkApp", () => {
  it("reports ok", () => {
    expect(checkApp().status).toBe("ok");
  });
});

describe("aggregateStatus / healthHttpStatus", () => {
  it("maps check mix to overall status and HTTP code", () => {
    const ok: Record<string, HealthCheck> = {
      a: { status: "ok" },
      b: { status: "skip" },
    };
    expect(aggregateStatus(ok)).toBe("ok");
    expect(
      healthHttpStatus({
        ok: true,
        status: "ok",
        service: "t",
        version: "1",
        time: "",
        checks: ok,
      }),
    ).toBe(200);

    const degraded: Record<string, HealthCheck> = {
      a: { status: "ok" },
      b: { status: "degraded" },
    };
    expect(aggregateStatus(degraded)).toBe("degraded");
    expect(
      healthHttpStatus({
        ok: true,
        status: "degraded",
        service: "t",
        version: "1",
        time: "",
        checks: degraded,
      }),
    ).toBe(200);

    expect(
      healthHttpStatus({
        ok: false,
        status: "error",
        service: "t",
        version: "1",
        time: "",
        checks: { a: { status: "error" } },
      }),
    ).toBe(503);
  });
});

describe("checkConfig", () => {
  it("reflects env presence without leaking values", () => {
    const keys = [
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
      "JWT_SECRET",
      "FRED_API_KEY",
    ] as const;
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) saved[k] = process.env[k];

    process.env.TURSO_DATABASE_URL = "libsql://x";
    process.env.TURSO_AUTH_TOKEN = "t";
    process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-32-chars";
    delete process.env.FRED_API_KEY;

    try {
      const c = checkConfig();
      expect(c.status).toBe("ok");
      expect(c.required).toMatchObject({
        TURSO_DATABASE_URL: true,
        TURSO_AUTH_TOKEN: true,
        JWT_SECRET: true,
      });
      expect(c.optional).toMatchObject({
        FRED_API_KEY: false,
        JWT_SECRET_STRONG: true,
      });
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });

  it("marks placeholder JWT secrets as degraded", () => {
    const keys = [
      "TURSO_DATABASE_URL",
      "TURSO_AUTH_TOKEN",
      "JWT_SECRET",
    ] as const;
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) saved[k] = process.env[k];

    process.env.TURSO_DATABASE_URL = "libsql://x";
    process.env.TURSO_AUTH_TOKEN = "t";
    process.env.JWT_SECRET = "secret";

    try {
      const c = checkConfig();
      expect(["degraded", "error"]).toContain(c.status);
      expect(c.optional).toMatchObject({ JWT_SECRET_STRONG: false });
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });
});

describe("deep probes", () => {
  it("marks Finnhub skip without key", async () => {
    const prev = process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    try {
      const c = await checkFinnhubQuote();
      expect(c.status).toBe("skip");
    } finally {
      if (prev !== undefined) process.env.FINNHUB_API_KEY = prev;
    }
  });

  it("checks Yahoo via fetchImpl", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const c = await checkYahooReachable(fetchImpl as unknown as typeof fetch);
    expect(c.status).toBe("ok");
  });
});

describe("buildHealthReport", () => {
  it("returns error when db client is null", async () => {
    const report = await buildHealthReport(null);
    expect(report.status).toBe("error");
    expect(report.checks.database?.status).toBe("error");
    expect(report.ok).toBe(false);
  });
});
