import { describe, expect, it } from "vitest";
import {
  alertEmailTemplate,
  otpEmailTemplate,
  watchlistBriefEmailTemplate,
} from "@/lib/email/templates";

describe("email templates", () => {
  it("builds a professional OTP message", () => {
    const template = otpEmailTemplate({ code: "123456", expireMinutes: 10 });
    expect(template.subject).toContain("123456");
    expect(template.html).toContain("Tell Research");
    expect(template.html).toContain("123456");
    expect(template.text).toContain("Expires in 10 minutes");
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
  });
});
