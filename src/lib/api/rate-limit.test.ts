import { afterEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/ai/rate-limit";
import {
  clientKey,
  enforceAuthIdentityRateLimit,
  enforceRateLimit,
  resolveRateLimitCategory,
} from "@/lib/api/rate-limit";

afterEach(() => {
  resetRateLimits();
  delete process.env.API_RATE_LIMIT_PER_MINUTE;
  delete process.env.AUTH_RATE_LIMIT_PER_MINUTE;
});

describe("clientKey", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const req = new Request("http://localhost/api/outlook", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(clientKey(req)).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip then anonymous", () => {
    const real = new Request("http://localhost/api/outlook", {
      headers: { "x-real-ip": "198.51.100.7" },
    });
    expect(clientKey(real)).toBe("198.51.100.7");
    expect(clientKey(new Request("http://localhost/api/outlook"))).toBe(
      "anonymous",
    );
  });
});

describe("resolveRateLimitCategory", () => {
  it("classifies health, auth, ai, write, and read paths", () => {
    expect(resolveRateLimitCategory("/api/health", "GET")).toBe("health");
    expect(resolveRateLimitCategory("/api/ready", "GET")).toBe("health");
    expect(resolveRateLimitCategory("/api/auth/login", "POST")).toBe("auth");
    expect(resolveRateLimitCategory("/api/brief", "GET")).toBe("brief");
    expect(resolveRateLimitCategory("/api/brief/history", "GET")).toBe("brief");
    expect(resolveRateLimitCategory("/api/chat", "POST")).toBe("chat");
    expect(resolveRateLimitCategory("/api/watchlist", "POST")).toBe("write");
    expect(resolveRateLimitCategory("/api/alerts", "DELETE")).toBe("write");
    expect(resolveRateLimitCategory("/api/watchlist", "GET")).toBe("api");
    expect(resolveRateLimitCategory("/api/outlook", "GET")).toBe("api");
  });
});

describe("enforceRateLimit", () => {
  it("returns 429 after the category limit is exceeded", () => {
    process.env.API_RATE_LIMIT_PER_MINUTE = "2";
    const req = new Request("http://localhost/api/outlook", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(enforceRateLimit(req)).toBeNull();
    expect(enforceRateLimit(req)).toBeNull();
    const blocked = enforceRateLimit(req);
    expect(blocked?.status).toBe(429);
  });
});

describe("enforceAuthIdentityRateLimit", () => {
  it("ignores empty identity", () => {
    expect(
      enforceAuthIdentityRateLimit(
        new Request("http://localhost/api/auth/login"),
        "   ",
      ),
    ).toBeNull();
  });

  it("rate limits by normalized email independently of IP", () => {
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = "2";
    const req = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "203.0.113.99" },
    });

    expect(enforceAuthIdentityRateLimit(req, "User@Example.com")).toBeNull();
    expect(enforceAuthIdentityRateLimit(req, "user@example.com")).toBeNull();
    const blocked = enforceAuthIdentityRateLimit(req, "USER@example.com");
    expect(blocked?.status).toBe(429);
  });
});
