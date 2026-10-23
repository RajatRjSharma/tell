import { describe, expect, it, vi } from "vitest";
import { generateGeminiText, thinkingConfigFor } from "@/lib/ai/gemini";
import { generateGroqChat, reasoningParamsFor } from "@/lib/ai/groq";
import { AiProviderError, runModelChain } from "@/lib/ai/provider";
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
      model: "openai/gpt-oss-20b",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello answer");
  });
});

function failing(status: number) {
  return { ok: false, status, text: async () => "nope" };
}

function geminiOk(text: string) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

describe("AI model fallback", () => {
  it("moves past overloaded and rate-limited models", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(failing(503))
      .mockResolvedValueOnce(failing(429))
      .mockResolvedValueOnce(geminiOk("third time"));

    const result = await generateGeminiText("prompt", {
      apiKey: "k",
      model: "gemini-custom",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.text).toBe("third time");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("fails fast on a bad key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(failing(401));
    await expect(
      generateGroqChat([{ role: "user", content: "hi" }], {
        apiKey: "k",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("treats a timeout as retryable", async () => {
    const result = await runModelChain("Test", ["slow", "fast"], (model) => {
      if (model === "slow") {
        return Promise.reject(new DOMException("t", "TimeoutError"));
      }
      return Promise.resolve(model);
    });
    expect(result).toBe("fast");
  });

  it("stops trying once the total budget is spent", async () => {
    const attempt = vi.fn(
      (_model: string, signal: AbortSignal) =>
        new Promise<string>((_, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );
    await expect(
      runModelChain("Test", ["a", "b", "c"], attempt, 100, 2_050),
    ).rejects.toMatchObject({ status: 504 });
    expect(attempt).toHaveBeenCalledTimes(1);
  }, 5_000);

  it("reports the last error when every model fails", async () => {
    await expect(
      runModelChain("Test", ["a", "b"], () =>
        Promise.reject(new AiProviderError("down", 503)),
      ),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("sends the key in a header, not the URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(geminiOk("x"));
    await generateGeminiText("p", {
      apiKey: "secret",
      json: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).not.toContain("secret");
    expect(init.headers["x-goog-api-key"]).toBe("secret");
    expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe(
      "application/json",
    );
  });

  it("picks per-model reasoning settings", () => {
    expect(thinkingConfigFor("gemini-2.5-flash")).toEqual({
      thinkingBudget: 0,
    });
    expect(thinkingConfigFor("gemini-3.1-flash-lite")).toEqual({
      thinkingLevel: "minimal",
    });
    expect(reasoningParamsFor("openai/gpt-oss-20b")).toMatchObject({
      reasoning_effort: "low",
    });
    expect(reasoningParamsFor("qwen/qwen3.8-27b")).toEqual({});
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
