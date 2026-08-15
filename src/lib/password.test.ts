import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  validateLoginCredentials,
  validateRegisterCredentials,
  validateUsername,
  verifyPassword,
  verifyPasswordOrPad,
} from "@/lib/password";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Rajat@Example.COM ")).toBe("rajat@example.com");
  });
});

describe("normalizeUsername", () => {
  it("trims and lowercases", () => {
    expect(normalizeUsername("  Rajat_01 ")).toBe("rajat_01");
  });
});

describe("validateUsername", () => {
  it("rejects short or invalid usernames", () => {
    expect(validateUsername("ab")).toMatch(/3–32|3-32|start with a letter/i);
    expect(validateUsername("1abc")).toMatch(/start with a letter/i);
    expect(validateUsername("Bad-Name")).toMatch(
      /start with a letter|letters/i,
    );
  });

  it("accepts valid usernames", () => {
    expect(validateUsername("rajat_01")).toBeNull();
  });
});

describe("validateLoginCredentials", () => {
  it("rejects invalid email identifiers", () => {
    expect(validateLoginCredentials("bad@domain", "password123")).toMatch(
      /valid email/i,
    );
  });

  it("rejects invalid username identifiers", () => {
    expect(validateLoginCredentials("1bad", "password123")).toMatch(
      /start with a letter|3–32/i,
    );
  });

  it("accepts username identifiers", () => {
    expect(validateLoginCredentials("rajat_01", "password123")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validateLoginCredentials("a@b.com", "short")).toMatch(/at least 8/i);
  });

  it("accepts legacy-length passwords on login", () => {
    expect(validateLoginCredentials("a@b.com", "password123")).toBeNull();
  });

  it("rejects oversized passwords", () => {
    expect(validateLoginCredentials("a@b.com", "x".repeat(73))).toMatch(
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
      validateRegisterCredentials("user@example.com", "TellSecure99!", {
        username: "macro_reader",
        confirmPassword: "TellSecure99!",
      }),
    ).toBeNull();
  });

  it("rejects mismatched confirm password", () => {
    expect(
      validateRegisterCredentials("user@example.com", "TellSecure99!", {
        username: "macro_reader",
        confirmPassword: "TellSecure98!",
      }),
    ).toMatch(/do not match/i);
  });

  it("rejects email local-part in password", () => {
    expect(
      validateRegisterCredentials("alice@example.com", "AliceSecure1!", {
        username: "macro_reader",
        confirmPassword: "AliceSecure1!",
      }),
    ).toMatch(/email/i);
  });

  it("rejects username in password", () => {
    expect(
      validateRegisterCredentials("user@example.com", "Macro_reader99!", {
        username: "macro_reader",
        confirmPassword: "Macro_reader99!",
      }),
    ).toMatch(/username/i);
  });
});

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123");
    expect(await verifyPassword("password123", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("pads unknown-account verification with bcrypt work", async () => {
    expect(await verifyPasswordOrPad("password123", null)).toBe(false);
    const hash = await hashPassword("password123");
    expect(await verifyPasswordOrPad("password123", hash)).toBe(true);
    expect(await verifyPasswordOrPad("wrong-password", hash)).toBe(false);
  });
});
