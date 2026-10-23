import type { ChatMessage } from "@/lib/ai/types";
import {
  AiConfigError,
  AiProviderError,
  providerError,
  runModelChain,
  uniqueModels,
} from "@/lib/ai/provider";

export type GroqChatOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export const GROQ_FALLBACK_MODELS = [
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
];

/**
 * gpt-oss models reason before answering and those tokens share the
 * completion budget; keep reasoning short and out of the response.
 */
export function reasoningParamsFor(model: string): Record<string, unknown> {
  return model.startsWith("openai/gpt-oss")
    ? { reasoning_effort: "low", include_reasoning: false }
    : {};
}

export async function generateGroqChat(
  messages: ChatMessage[],
  options?: GroqChatOptions,
): Promise<{ text: string; model: string }> {
  const apiKey = (options?.apiKey ?? process.env.GROQ_API_KEY)?.trim();
  if (!apiKey) {
    throw new AiConfigError("GROQ_API_KEY is not configured");
  }

  const models = uniqueModels([
    options?.model ?? process.env.GROQ_MODEL,
    ...GROQ_FALLBACK_MODELS,
  ]);
  const fetchImpl = options?.fetchImpl ?? fetch;

  return runModelChain(
    "Groq",
    models,
    async (model, signal) => {
      const response = await fetchImpl(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            temperature: options?.temperature ?? 0.3,
            max_completion_tokens: options?.maxTokens ?? 1024,
            messages: messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            ...reasoningParamsFor(model),
          }),
        },
      );

      if (!response.ok) throw await providerError("Groq", model, response);

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        throw new AiProviderError(
          `Groq ${model} returned an empty answer`,
          502,
        );
      }
      return { text, model };
    },
    options?.timeoutMs,
  );
}
