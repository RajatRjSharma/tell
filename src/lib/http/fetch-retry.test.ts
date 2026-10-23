import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry, retryDelayMs } from "@/lib/http/fetch-retry";

const noSleep = () => Promise.resolve();

function response(status: number, headers: Record<string, string> = {}) {
  return new Response("body", { status, headers });
}

describe("retryDelayMs", () => {
  it("backs off exponentially without Retry-After", () => {
    expect(retryDelayMs(0, 500, null)).toBe(500);
    expect(retryDelayMs(2, 500, null)).toBe(2000);
  });

  it("honours Retry-After seconds and caps it", () => {
    expect(retryDelayMs(0, 500, "3")).toBe(3000);
    expect(retryDelayMs(0, 500, "120")).toBe(30_000);
  });

  it("honours Retry-After HTTP dates", () => {
    const now = Date.parse("2026-10-23T00:00:00Z");
    expect(retryDelayMs(0, 500, "Fri, 23 Oct 2026 00:00:05 GMT", now)).toBe(
      5000,
    );
  });
});

describe("fetchWithRetry", () => {
  it("retries 503 then returns the success", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200));
    const res = await fetchWithRetry("https://x.test", undefined, {
      fetchImpl,
      sleep: noSleep,
    });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry 404", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(404));
    const res = await fetchWithRetry("https://x.test", undefined, {
      fetchImpl,
      sleep: noSleep,
    });
    expect(res.status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the last retryable response once retries run out", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(429));
    const res = await fetchWithRetry("https://x.test", undefined, {
      fetchImpl,
      retries: 2,
      sleep: noSleep,
    });
    expect(res.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries network errors and rethrows the final one", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      fetchWithRetry("https://x.test", undefined, {
        fetchImpl,
        retries: 1,
        sleep: noSleep,
      }),
    ).rejects.toThrow("fetch failed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("attaches an abort signal to every attempt", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(200));
    await fetchWithRetry(
      "https://x.test",
      { headers: { a: "b" } },
      {
        fetchImpl,
      },
    );
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.headers).toEqual({ a: "b" });
  });
});
