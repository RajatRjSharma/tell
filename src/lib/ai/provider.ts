export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiProviderError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "AiProviderError";
    this.status = status;
  }
}

export const AI_ATTEMPT_TIMEOUT_MS = 12_000;
/** Upper bound across all fallbacks, so a slow provider can't hang a request. */
export const AI_TOTAL_BUDGET_MS = 30_000;
const MIN_ATTEMPT_MS = 2_000;

/**
 * Statuses where another model may succeed: retired or unknown model (404),
 * per-model quota (429), and provider overload or outage (5xx). Auth and
 * request-shape errors (400/401/403) fail fast because every model would
 * reject them the same way.
 */
export function shouldTryNextModel(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}

export function uniqueModels(models: Array<string | undefined>): string[] {
  return models
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model))
    .filter((model, index, all) => all.indexOf(model) === index);
}

/**
 * Calls `attempt` for each model in order until one succeeds. Timeouts and
 * network failures count as retryable, like a 5xx. Each attempt gets
 * `timeoutMs`, cut short so the whole chain stays within `budgetMs`.
 */
export async function runModelChain<T>(
  provider: string,
  models: string[],
  attempt: (model: string, signal: AbortSignal) => Promise<T>,
  timeoutMs = AI_ATTEMPT_TIMEOUT_MS,
  budgetMs = AI_TOTAL_BUDGET_MS,
): Promise<T> {
  const deadline = Date.now() + budgetMs;
  let lastError: AiProviderError | null = null;

  for (const model of models) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const limit = Math.min(timeoutMs, remaining);
    try {
      return await attempt(model, AbortSignal.timeout(limit));
    } catch (error) {
      if (error instanceof AiProviderError) {
        if (!shouldTryNextModel(error.status)) throw error;
        lastError = error;
        continue;
      }
      const timedOut =
        error instanceof DOMException &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = new AiProviderError(
        timedOut
          ? `${provider} ${model} timed out after ${limit}ms`
          : `${provider} ${model} unreachable`,
        timedOut ? 504 : 502,
      );
    }
  }

  throw lastError ?? new AiProviderError(`${provider} models unavailable`, 502);
}

export async function providerError(
  provider: string,
  model: string,
  response: Response,
): Promise<AiProviderError> {
  const body = await response.text().catch(() => "");
  return new AiProviderError(
    `${provider} ${model} request failed (${response.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
    response.status >= 400 && response.status < 600 ? response.status : 502,
  );
}
