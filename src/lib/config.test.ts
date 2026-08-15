import { afterEach, describe, expect, it } from "vitest";
import {
  apiRateLimitPerMinute,
  appUrl,
  authRateLimitPerMinute,
  briefRateLimitPerMinute,
  chatRateLimitPerMinute,
  emailOtpEnabled,
  jwtIssuer,
  registrationEnabled,
  sessionCookieSameSite,
  sessionExpireDays,
} from "@/lib/config";

const KEYS = [
  "APP_URL",
  "REGISTRATION_ENABLED",
  "EMAIL_OTP_ENABLED",
  "JWT_EXPIRE_DAYS",
  "JWT_ISSUER",
  "AUTH_COOKIE_SAMESITE",
  "AUTH_RATE_LIMIT_PER_MINUTE",
  "BRIEF_RATE_LIMIT_PER_MINUTE",
  "CHAT_RATE_LIMIT_PER_MINUTE",
  "API_RATE_LIMIT_PER_MINUTE",
] as const;

afterEach(() => {
  for (const key of KEYS) {
    delete process.env[key];
  }
});

describe("config", () => {
  it("defaults registration and email OTP to enabled", () => {
    expect(registrationEnabled()).toBe(true);
    expect(emailOtpEnabled()).toBe(true);
  });

  it("parses registration and OTP flags", () => {
    process.env.REGISTRATION_ENABLED = "false";
    process.env.EMAIL_OTP_ENABLED = "0";
    expect(registrationEnabled()).toBe(false);
    expect(emailOtpEnabled()).toBe(false);
  });

  it("clamps session days and rate limits", () => {
    process.env.JWT_EXPIRE_DAYS = "999";
    process.env.AUTH_RATE_LIMIT_PER_MINUTE = "0";
    expect(sessionExpireDays()).toBe(90);
    expect(authRateLimitPerMinute()).toBe(1);

    process.env.BRIEF_RATE_LIMIT_PER_MINUTE = "50";
    process.env.CHAT_RATE_LIMIT_PER_MINUTE = "12";
    process.env.API_RATE_LIMIT_PER_MINUTE = "80";
    expect(briefRateLimitPerMinute()).toBe(50);
    expect(chatRateLimitPerMinute()).toBe(12);
    expect(apiRateLimitPerMinute()).toBe(80);
  });

  it("normalizes cookie sameSite and app URL", () => {
    process.env.AUTH_COOKIE_SAMESITE = "NONE";
    expect(sessionCookieSameSite()).toBe("none");
    process.env.APP_URL = "https://example.com/";
    expect(appUrl()).toBe("https://example.com");
  });

  it("defaults JWT issuer to tell and respects overrides", () => {
    expect(jwtIssuer()).toBe("tell");
    process.env.JWT_ISSUER = " tell-prod ";
    expect(jwtIssuer()).toBe("tell-prod");
  });
});
