import {
  AiConfigError,
  AiProviderError,
  providerError,
  runModelChain,
  uniqueModels,
} from "@/lib/ai/provider";

export type GeminiGenerateOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask for a JSON response body instead of free text. */
  json?: boolean;
  timeoutMs?: number;
};

export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
];

/**
 * Thinking tokens count against maxOutputTokens, so an unbounded budget can
 * leave no room for the answer. Gemini 2.x only accepts a token budget and
 * rejects `thinkingLevel`; 3.x takes a level.
 */
export function thinkingConfigFor(model: string): Record<string, unknown> {
  return /^gemini-2\./.test(model)
    ? { thinkingBudget: 0 }
    : { thinkingLevel: "minimal" };
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  const content = (candidates[0] as { content?: { parts?: unknown } }).content;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) =>
      part &&
      typeof part === "object" &&
      typeof (part as { text?: unknown }).text === "string" &&
      !(part as { thought?: unknown }).thought
        ? (part as { text: string }).text
        : "",
    )
    .join("")
    .trim();
}

export async function generateGeminiText(
  prompt: string,
  options?: GeminiGenerateOptions,
): Promise<{ text: string; model: string }> {
  const apiKey = (options?.apiKey ?? process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    throw new AiConfigError("GEMINI_API_KEY is not configured");
  }

  const models = uniqueModels([
    options?.model ?? process.env.GEMINI_MODEL,
    ...GEMINI_FALLBACK_MODELS,
  ]);
  const fetchImpl = options?.fetchImpl ?? fetch;

  return runModelChain(
    "Gemini",
    models,
    async (model, signal) => {
      const response = await fetchImpl(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          signal,
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options?.temperature ?? 0.35,
              maxOutputTokens: options?.maxOutputTokens ?? 1024,
              thinkingConfig: thinkingConfigFor(model),
              ...(options?.json
                ? { responseMimeType: "application/json" }
                : {}),
            },
          }),
        },
      );

      if (!response.ok) throw await providerError("Gemini", model, response);

      const text = extractText((await response.json()) as unknown);
      if (!text) {
        throw new AiProviderError(`Gemini ${model} returned no text`, 502);
      }
      return { text, model };
    },
    options?.timeoutMs,
  );
}
