import { describe, expect, it } from "vitest";
import {
  alertEmailTemplate,
  alreadyRegisteredEmailTemplate,
  otpEmailTemplate,
  watchlistBriefEmailTemplate,
} from "@/lib/email/templates";

describe("email templates", () => {
  it("builds a professional OTP message", () => {
    const template = otpEmailTemplate({ code: "123456", expireMinutes: 10 });
    expect(template.subject).not.toContain("123456");
    expect(template.html).toContain("Tell Research");
    expect(template.html).toContain("123456");
    const preheader = template.html.match(
      /<div style="display:none[^>]*>(.*?)<\/div>/,
    )?.[1];
    expect(preheader).not.toContain("123456");
    expect(template.text).toContain("Expires in 10 minutes");
  });

  it("builds an already-registered notice without a code", () => {
    const template = alreadyRegisteredEmailTemplate({
      appUrl: "https://example.com",
    });
    expect(template.subject).toMatch(/account/i);
    expect(template.html).toContain("already have an account");
    expect(template.html).toContain("https://example.com/login");
    expect(template.text).not.toMatch(/\d{4,8}/);
  });

  it("builds an alert message with symbol metadata", () => {
    const template = alertEmailTemplate({
      title: "SPY 1d flipped to bearish",
      body: "Outlook moved from bullish to bearish.",
      symbol: "SPY",
      horizon: "1d",
      asOfDate: "2026-08-15",
      appUrl: "https://example.com",
    });
    expect(template.subject).toContain("SPY");
    expect(template.html).toContain("Open Tell outlook");
    expect(template.text).toContain("As of: 2026-08-15");
  });

  it("builds a watchlist brief message", () => {
    const template = watchlistBriefEmailTemplate({
      asOf: "2026-08-15",
      summary: "Risk stays mixed.",
      bullets: ["Curve still inverted", "VIX calm"],
      symbols: ["SPY", "TLT"],
    });
    expect(template.subject).toContain("watchlist brief");
    expect(template.html).toContain("SPY · TLT");
    expect(template.text).toContain("Curve still inverted");
    expect(template.text).toContain("Not financial advice");
  });

  it("rejects unsafe link schemes in favor of the production fallback", () => {
    const template = alertEmailTemplate({
      title: "SPY update",
      body: "Fixture",
      symbol: "SPY",
      horizon: "1d",
      asOfDate: "2026-08-15",
      appUrl: "javascript:alert(1)",
    });

    expect(template.html).not.toContain("javascript:");
    expect(template.html).toContain("https://tell-gamma.vercel.app");
  });
});
