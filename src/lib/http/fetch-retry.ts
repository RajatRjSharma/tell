export type RetryOptions = {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRY_AFTER_MS = 30_000;

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/** Honour Retry-After (seconds or HTTP date), else exponential backoff. */
export function retryDelayMs(
  attempt: number,
  baseDelayMs: number,
  retryAfter: string | null,
  now = Date.now(),
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) {
      return Math.min(Math.max(at - now, 0), MAX_RETRY_AFTER_MS);
    }
  }
  return baseDelayMs * 2 ** attempt;
}

function withTimeout(init: RequestInit | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return { ...init, signal };
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with a per-attempt timeout and bounded retries on network errors,
 * 408/425/429 and 5xx. Non-retryable responses are returned as-is.
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options?: RetryOptions,
): Promise<Response> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 20_000;
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 1_000;
  const sleep = options?.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    let delay: number;
    try {
      const response = await fetchImpl(input, withTimeout(init, timeoutMs));
      if (!isRetryableStatus(response.status) || attempt >= retries) {
        return response;
      }
      delay = retryDelayMs(
        attempt,
        baseDelayMs,
        response.headers?.get?.("retry-after") ?? null,
      );
    } catch (error) {
      if (attempt >= retries) throw error;
      delay = retryDelayMs(attempt, baseDelayMs, null);
    }
    await sleep(delay);
  }
}

/** Drop-in `fetch` for scheduled ingest jobs. */
export const resilientFetch: typeof fetch = (input, init) =>
  fetchWithRetry(input, init);
