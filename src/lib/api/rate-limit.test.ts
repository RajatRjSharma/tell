import { afterEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/ai/rate-limit";
import {
  enforceRateLimit,
  resolveRateLimitCategory,
} from "@/lib/api/rate-limit";

afterEach(() => {
  resetRateLimits();
  delete process.env.API_RATE_LIMIT_PER_MINUTE;
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
