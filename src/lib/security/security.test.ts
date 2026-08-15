import { describe, expect, it } from "vitest";
import { enforceCsrf } from "@/lib/security/csrf";
import {
  enforceAllowedMethod,
  enforceBodySize,
  requireJsonContentType,
} from "@/lib/security/request";
import { jwtSecretStatus } from "@/lib/security/secrets";
import { hashOtp } from "@/lib/auth/otp";

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
      headers: { "content-type": "text/plain" },
    });
    expect(requireJsonContentType(req)?.status).toBe(415);
  });
});

describe("otp hashing", () => {
  it("is deterministic for the same pepper", () => {
    process.env.OTP_PEPPER = "unit-test-pepper";
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
    delete process.env.OTP_PEPPER;
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
});

describe("safePublicDetail", () => {
  it("keeps short validation messages", async () => {
    const { safePublicDetail } = await import("@/lib/security/http-errors");
    expect(safePublicDetail(new Error("Invalid symbol"), "fallback")).toBe(
      "Invalid symbol",
    );
  });

  it("hides leaky infra messages", async () => {
    const { GENERIC_AI, safePublicDetail } = await import(
      "@/lib/security/http-errors"
    );
    expect(
      safePublicDetail(
        new Error("SQLITE_ERROR: no such table users"),
        GENERIC_AI,
      ),
    ).toBe(GENERIC_AI);
  });
});
