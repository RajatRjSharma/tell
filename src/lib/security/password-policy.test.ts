import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePasswordStrength,
} from "@/lib/security/password-policy";

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(
      validatePasswordStrength("TellSecure99!", { email: "user@example.com" }),
    ).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(validatePasswordStrength("Ab1!short")).toMatch(
      new RegExp(`at least ${PASSWORD_MIN_LENGTH}`, "i"),
    );
  });

  it("rejects oversized passwords", () => {
    expect(
      validatePasswordStrength(`Aa1!${"x".repeat(PASSWORD_MAX_LENGTH)}`),
    ).toMatch(/at most 72/i);
  });

  it("rejects leading or trailing whitespace", () => {
    expect(validatePasswordStrength(" TellSecure99!")).toMatch(/whitespace/i);
    expect(validatePasswordStrength("TellSecure99! ")).toMatch(/whitespace/i);
  });

  it("requires mixed case, digit, and special", () => {
    expect(validatePasswordStrength("tellsecure99!")).toMatch(/uppercase/i);
    expect(validatePasswordStrength("TELLSECURE99!")).toMatch(/lowercase/i);
    expect(validatePasswordStrength("TellSecure!!!")).toMatch(/number/i);
    expect(validatePasswordStrength("TellSecure999")).toMatch(/special/i);
  });

  it("rejects email local-part substrings", () => {
    expect(
      validatePasswordStrength("AliceSecure1!", { email: "alice@example.com" }),
    ).toMatch(/email/i);
  });

  it("rejects common banned passwords", () => {
    expect(validatePasswordStrength("Password123!")).toMatch(/too common/i);
  });
});
