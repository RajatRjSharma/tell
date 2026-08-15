import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  authenticateApiRequest,
  isPublicApiRoute,
  readBearerToken,
} from "@/lib/api/auth-guard";

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
});

describe("isPublicApiRoute", () => {
  it("allows auth bootstrap and health only", () => {
    expect(isPublicApiRoute("/api/health", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/ready", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/auth/login", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/otp/request", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/me", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/auth/config", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/outlook", "GET")).toBe(false);
    expect(isPublicApiRoute("/api/auth/login", "GET")).toBe(false);
    expect(isPublicApiRoute("/api/chat", "POST")).toBe(false);
  });
});

describe("authenticateApiRequest", () => {
  it("accepts a valid Bearer token", async () => {
    process.env.JWT_SECRET = "test-secret-for-auth-guard-32chars!!";
    process.env.JWT_ISSUER = "tell";
    const token = await new SignJWT({ email: "a@b.com", type: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("tell")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));

    const request = new Request("http://localhost/api/outlook", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(readBearerToken(request)).toBe(token);
    const session = await authenticateApiRequest(request);
    expect(session).toEqual({ sub: "user-1", email: "a@b.com" });
  });

  it("rejects missing or invalid tokens", async () => {
    process.env.JWT_SECRET = "test-secret-for-auth-guard-32chars!!";
    const bare = new Request("http://localhost/api/outlook");
    expect(await authenticateApiRequest(bare)).toBeNull();

    const bad = new Request("http://localhost/api/outlook", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(await authenticateApiRequest(bad)).toBeNull();
  });
});
