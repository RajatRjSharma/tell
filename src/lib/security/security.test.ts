import { afterEach, describe, expect, it } from "vitest";
import { enforceCsrf } from "@/lib/security/csrf";
import {
  apiCacheHeaders,
  applySecurityHeaders,
  securityHeaders,
} from "@/lib/security/headers";
import {
  GENERIC_AI,
  GENERIC_SERVER,
  safePublicDetail,
} from "@/lib/security/http-errors";
import {
  enforceAllowedMethod,
  enforceBodySize,
  requireJsonContentType,
} from "@/lib/security/request";
import {
  jwtSecretStatus,
  assertAuthConfigForProduction,
} from "@/lib/security/secrets";
import { hashOtp } from "@/lib/auth/otp";

afterEach(() => {
  delete process.env.APP_ENV;
  delete process.env.OTP_PEPPER;
  delete process.env.TELL_OTP_DEV_ECHO;
});

describe("csrf", () => {
  it("allows same-origin mutating requests", () => {
    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
    });
    expect(enforceCsrf(req)).toBeNull();
  });

  it("allows matching Referer when Origin is absent", () => {
    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "http://localhost:3000/login",
      },
    });
    expect(enforceCsrf(req)).toBeNull();
  });

  it("blocks cross-site Origin", () => {
    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil.example",
      },
    });
    expect(enforceCsrf(req)?.status).toBe(403);
  });

  it("skips CSRF for Bearer tokens", () => {
    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: {
        authorization: "Bearer fake.token.value",
        origin: "https://evil.example",
      },
    });
    expect(enforceCsrf(req)).toBeNull();
  });

  it("requires Origin or Referer in production-like envs", () => {
    process.env.APP_ENV = "production";
    const req = new Request("https://tell.example/api/watchlist", {
      method: "POST",
      headers: { host: "tell.example" },
    });
    expect(enforceCsrf(req)?.status).toBe(403);
  });
});

describe("request guards", () => {
  it("rejects disallowed methods", () => {
    const req = { method: "TRACE" } as Request;
    expect(enforceAllowedMethod(req)?.status).toBe(405);
  });

  it("rejects oversized Content-Length", () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-length": String(1024 * 1024) },
    });
    expect(enforceBodySize(req)?.status).toBe(413);
  });

  it("requires JSON content type on POST", () => {
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "text/plain", "content-length": "12" },
    });
    expect(requireJsonContentType(req)?.status).toBe(415);
  });

  it("allows empty-body POST without Content-Type", () => {
    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { "content-length": "0" },
    });
    expect(requireJsonContentType(req)).toBeNull();
  });
});

describe("security headers", () => {
  it("includes CSP and frame denial by default", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).not.toContain("Strict-Transport-Security");
  });

  it("adds HSTS when production-like", () => {
    process.env.APP_ENV = "production";
    expect(
      securityHeaders().some((h) => h.key === "Strict-Transport-Security"),
    ).toBe(true);
  });

  it("applies cache headers by route class", () => {
    expect(apiCacheHeaders("/api/auth/login")[0]?.value).toMatch(/no-store/i);
    expect(apiCacheHeaders("/api/health")[0]?.value).toBe("no-store");
    expect(apiCacheHeaders("/api/outlook")[0]?.value).toBe("private, no-store");
  });

  it("does not overwrite existing header values", () => {
    const headers = new Headers({ "X-Frame-Options": "SAMEORIGIN" });
    applySecurityHeaders(headers);
    expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("otp hashing", () => {
  it("is deterministic for the same pepper", () => {
    process.env.OTP_PEPPER = "unit-test-pepper";
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
  });
});

describe("jwtSecretStatus", () => {
  it("flags short secrets", () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "short";
    expect(jwtSecretStatus().strong).toBe(false);
    if (prev === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev;
  });

  it("accepts long random secrets", () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-32-chars!!";
    expect(jwtSecretStatus().strong).toBe(true);
    if (prev === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prev;
  });
});

describe("assertAuthConfigForProduction", () => {
  it("blocks OTP echo in production-like environments", () => {
    const prevEnv = process.env.APP_ENV;
    const prevEcho = process.env.TELL_OTP_DEV_ECHO;
    const prevSecret = process.env.JWT_SECRET;
    process.env.APP_ENV = "production";
    process.env.JWT_SECRET = "unit-test-jwt-secret-at-least-32-chars!!";
    process.env.TELL_OTP_DEV_ECHO = "1";
    expect(() => assertAuthConfigForProduction()).toThrow(/TELL_OTP_DEV_ECHO/);
    if (prevEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prevEnv;
    if (prevEcho === undefined) delete process.env.TELL_OTP_DEV_ECHO;
    else process.env.TELL_OTP_DEV_ECHO = prevEcho;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  });
});

describe("safePublicDetail", () => {
  it("keeps short validation messages", () => {
    expect(safePublicDetail(new Error("Invalid symbol"), "fallback")).toBe(
      "Invalid symbol",
    );
  });

  it("hides leaky infra messages", () => {
    expect(
      safePublicDetail(
        new Error("SQLITE_ERROR: no such table users"),
        GENERIC_AI,
      ),
    ).toBe(GENERIC_AI);
    expect(
      safePublicDetail(new Error("Missing GEMINI_API_KEY secret"), GENERIC_AI),
    ).toBe(GENERIC_AI);
  });

  it("falls back for empty, huge, or non-error values", () => {
    expect(safePublicDetail(null)).toBe(GENERIC_SERVER);
    expect(safePublicDetail(new Error("x".repeat(200)))).toBe(GENERIC_SERVER);
    expect(safePublicDetail({ oops: true })).toBe(GENERIC_SERVER);
  });
});
