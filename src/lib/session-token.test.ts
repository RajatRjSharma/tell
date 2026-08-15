import { afterEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/session-token";

afterEach(() => {
  delete process.env.JWT_ISSUER;
});

describe("session JWT", () => {
  it("signs and verifies a session payload", async () => {
    const token = await signSession({
      sub: "user-1",
      email: "rajat@example.com",
    });

    const session = await verifySession(token);
    expect(session).toEqual({
      sub: "user-1",
      email: "rajat@example.com",
    });
  });

  it("rejects tampered tokens", async () => {
    const token = await signSession({
      sub: "user-1",
      email: "rajat@example.com",
    });

    expect(await verifySession(`${token}tampered`)).toBeNull();
    expect(await verifySession("not-a-jwt")).toBeNull();
  });

  it("rejects tokens with the wrong issuer", async () => {
    process.env.JWT_ISSUER = "tell";
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT({ email: "a@b.com", type: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("other-app")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });

  it("rejects tokens with a non-session type claim", async () => {
    process.env.JWT_ISSUER = "tell";
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT({ email: "a@b.com", type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("tell")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });

  it("rejects tokens missing email", async () => {
    process.env.JWT_ISSUER = "tell";
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const token = await new SignJWT({ type: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuer("tell")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(secret);

    expect(await verifySession(token)).toBeNull();
  });
});
