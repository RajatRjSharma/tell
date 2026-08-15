import { describe, expect, it, vi } from "vitest";
import { generateGeminiText } from "@/lib/ai/gemini";
import { generateGroqChat } from "@/lib/ai/groq";
import { parseBriefJson } from "@/lib/ai/brief";
import { sanitizeHistory } from "@/lib/ai/chat";
import { cacheClear, cacheGet, cacheSet } from "@/lib/ai/cache";
import { rateLimit, resetRateLimits } from "@/lib/ai/rate-limit";

describe("generateGeminiText", () => {
  it("parses generateContent text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "hello brief" }] } }],
      }),
    });

    const result = await generateGeminiText("prompt", {
      apiKey: "test-key",
      model: "gemini-3.1-flash-lite",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello brief");
    expect(result.model).toBe("gemini-3.1-flash-lite");
  });

  it("falls back when preferred model is missing", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "missing",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "fallback brief" }] } }],
        }),
      });

    const result = await generateGeminiText("prompt", {
      apiKey: "test-key",
      model: "gone-model",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("fallback brief");
    expect(result.model).toBe("gemini-3.1-flash-lite");
  });
});

describe("generateGroqChat", () => {
  it("parses chat completion text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "hello answer" } }],
      }),
    });

    const result = await generateGroqChat([{ role: "user", content: "hi" }], {
      apiKey: "test-key",
      model: "llama-3.1-8b-instant",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello answer");
  });
});

describe("parseBriefJson", () => {
  it("parses structured json", () => {
    const brief = parseBriefJson(
      JSON.stringify({
        title: "SPY brief",
        summary: "Neutral with mixed inflation.",
        bullets: ["Score near zero"],
        risks: ["Policy surprise"],
      }),
      {
        model: "gemini-2.5-flash-lite",
        asOf: "2026-08-14",
        symbol: "SPY",
        horizon: "1d",
        cached: false,
      },
    );

    expect(brief.title).toBe("SPY brief");
    expect(brief.bullets).toEqual(["Score near zero"]);
  });
});

describe("sanitizeHistory", () => {
  it("keeps only recent user/assistant turns", () => {
    const cleaned = sanitizeHistory(
      [
        { role: "system", content: "nope" },
        { role: "user", content: "one" },
        { role: "assistant", content: "two" },
        { role: "user", content: "three" },
      ],
      2,
    );
    expect(cleaned).toEqual([
      { role: "assistant", content: "two" },
      { role: "user", content: "three" },
    ]);
  });
});

describe("cache helpers", () => {
  it("stores and expires values", () => {
    cacheClear();
    cacheSet("k", { ok: true }, 60_000);
    expect(cacheGet<{ ok: boolean }>("k")).toEqual({ ok: true });
  });
});

describe("rateLimit", () => {
  it("blocks after limit", () => {
    resetRateLimits();
    expect(rateLimit("x", 2, 60_000).ok).toBe(true);
    expect(rateLimit("x", 2, 60_000).ok).toBe(true);
    expect(rateLimit("x", 2, 60_000).ok).toBe(false);
  });
});
