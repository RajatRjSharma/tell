import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/session-token";

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
});
