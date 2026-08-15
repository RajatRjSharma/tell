export type GeminiGenerateOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  temperature?: number;
  maxOutputTokens?: number;
};

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
      typeof (part as { text?: unknown }).text === "string"
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
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new AiConfigError("GEMINI_API_KEY is not configured");
  }

  const preferred =
    options?.model ?? process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
  const models = [
    preferred,
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ].filter((model, index, all) => all.indexOf(model) === index);

  const fetchImpl = options?.fetchImpl ?? fetch;
  let lastError: AiProviderError | null = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options?.temperature ?? 0.35,
          maxOutputTokens: options?.maxOutputTokens ?? 700,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      lastError = new AiProviderError(
        `Gemini request failed (${response.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
        response.status >= 400 && response.status < 600 ? response.status : 502,
      );
      if (response.status === 404) continue;
      throw lastError;
    }

    const payload = (await response.json()) as unknown;
    const text = extractText(payload);
    if (!text) {
      throw new AiProviderError("Gemini returned an empty brief", 502);
    }

    return { text, model };
  }

  throw lastError ?? new AiProviderError("Gemini models unavailable", 502);
}
