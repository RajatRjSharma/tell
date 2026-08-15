import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from "@/lib/password";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Rajat@Example.COM ")).toBe("rajat@example.com");
  });
});

describe("validateCredentials", () => {
  it("rejects invalid email", () => {
    expect(validateCredentials("not-an-email", "password123")).toMatch(
      /valid email/i,
    );
  });

  it("rejects short passwords", () => {
    expect(validateCredentials("a@b.com", "short")).toMatch(/at least 8/i);
  });

  it("accepts valid credentials", () => {
    expect(validateCredentials("a@b.com", "password123")).toBeNull();
  });
});

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
