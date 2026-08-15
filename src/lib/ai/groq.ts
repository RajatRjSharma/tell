import type { ChatMessage } from "@/lib/ai/types";
import { AiConfigError, AiProviderError } from "@/lib/ai/gemini";

export type GroqChatOptions = {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  temperature?: number;
  maxTokens?: number;
};

export async function generateGroqChat(
  messages: ChatMessage[],
  options?: GroqChatOptions,
): Promise<{ text: string; model: string }> {
  const apiKey = options?.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) {
    throw new AiConfigError("GROQ_API_KEY is not configured");
  }

  const model =
    options?.model ?? process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
  const fetchImpl = options?.fetchImpl ?? fetch;

  const response = await fetchImpl(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 700,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiProviderError(
      `Groq request failed (${response.status})${body ? `: ${body.slice(0, 180)}` : ""}`,
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new AiProviderError("Groq returned an empty answer", 502);
  }

  return { text, model };
}
