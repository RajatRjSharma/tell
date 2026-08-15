import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  validateRegisterCredentials,
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

  it("accepts legacy-length passwords on login", () => {
    expect(validateCredentials("a@b.com", "password123")).toBeNull();
  });

  it("rejects oversized passwords", () => {
    expect(validateCredentials("a@b.com", "x".repeat(73))).toMatch(
      /at most 72/i,
    );
  });
});

describe("validateRegisterCredentials", () => {
  it("requires complexity", () => {
    expect(validateRegisterCredentials("a@b.com", "password123")).toMatch(
      /uppercase|special|at least 12/i,
    );
  });

  it("accepts strong passwords", () => {
    expect(
      validateRegisterCredentials("user@example.com", "TellSecure99!"),
    ).toBeNull();
  });

  it("rejects email local-part in password", () => {
    expect(
      validateRegisterCredentials("alice@example.com", "AliceSecure1!"),
    ).toMatch(/email/i);
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
