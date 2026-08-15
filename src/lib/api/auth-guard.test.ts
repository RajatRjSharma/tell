import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  authenticateApiRequest,
  isPublicApiRoute,
  isPublicPageRoute,
  isSession,
  readBearerToken,
  requireApiSession,
} from "@/lib/api/auth-guard";
import { OPENAPI_SECURED_PATHS } from "@/lib/api/protected-paths";

afterEach(() => {
  delete process.env.JWT_SECRET;
  delete process.env.JWT_ISSUER;
});

async function mintBearer(email = "a@b.com", sub = "user-1", username = "alice") {
  process.env.JWT_SECRET = "test-secret-for-auth-guard-32chars!!";
  process.env.JWT_ISSUER = "tell";
  return new SignJWT({ email, username, type: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("tell")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
}

describe("isPublicApiRoute", () => {
  it("allows auth bootstrap, health, and openapi only", () => {
    expect(isPublicApiRoute("/api/health", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/ready", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/openapi", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/auth/login", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/otp/request", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/otp/verify", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/logout", "POST")).toBe(true);
    expect(isPublicApiRoute("/api/auth/me", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/auth/config", "GET")).toBe(true);
    expect(isPublicApiRoute("/api/outlook", "GET")).toBe(false);
    expect(isPublicApiRoute("/api/auth/login", "GET")).toBe(false);
    expect(isPublicApiRoute("/api/chat", "POST")).toBe(false);
    expect(isPublicApiRoute("/api/openapi", "POST")).toBe(false);
  });

  it("treats secured openapi paths as non-public", () => {
    for (const path of OPENAPI_SECURED_PATHS) {
      const probe = path.replace("{symbol}", "SPY").replace("{id}", "1");
      const method =
        path === "/api/chat" || path === "/api/alerts/read" ? "POST" : "GET";
      expect(isPublicApiRoute(probe, method), `${method} ${probe}`).toBe(false);
    }
  });
});

describe("isPublicPageRoute", () => {
  it("allows only login, register, docs, and well-known", () => {
    expect(isPublicPageRoute("/login")).toBe(true);
    expect(isPublicPageRoute("/register")).toBe(true);
    expect(isPublicPageRoute("/docs")).toBe(true);
    expect(isPublicPageRoute("/.well-known/security.txt")).toBe(true);
    expect(isPublicPageRoute("/")).toBe(false);
    expect(isPublicPageRoute("/methodology")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    expect(isPublicPageRoute("/login/")).toBe(true);
    expect(isPublicPageRoute("/docs/")).toBe(true);
  });
});

describe("authenticateApiRequest", () => {
  it("accepts a valid Bearer token", async () => {
    const token = await mintBearer();
    const request = new Request("http://localhost/api/outlook", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(readBearerToken(request)).toBe(token);
    const session = await authenticateApiRequest(request);
    expect(session).toEqual({
      sub: "user-1",
      email: "a@b.com",
      username: "alice",
    });
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

  it("requireApiSession returns 401 without a session", async () => {
    process.env.JWT_SECRET = "test-secret-for-auth-guard-32chars!!";
    const result = await requireApiSession(
      new Request("http://localhost/api/assets"),
    );
    expect(isSession(result)).toBe(false);
    if (!isSession(result)) {
      expect(result.status).toBe(401);
      const body = (await result.json()) as { error: string };
      expect(body.error).toMatch(/authentication required/i);
    }
  });

  it("requireApiSession returns the session for a valid bearer", async () => {
    const token = await mintBearer("ok@tell.test", "user-42", "okuser");
    const result = await requireApiSession(
      new Request("http://localhost/api/assets", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(isSession(result)).toBe(true);
    if (isSession(result)) {
      expect(result).toEqual({
        sub: "user-42",
        email: "ok@tell.test",
        username: "okuser",
      });
    }
  });
});
