import type { Client } from "@libsql/client";
import {
  buildResearchContext,
  extractCitations,
  formatResearchContext,
} from "@/lib/ai/context";
import { generateGroqChat } from "@/lib/ai/groq";
import {
  AI_DISCLAIMER,
  type ChatMessage,
  type ChatResult,
} from "@/lib/ai/types";

const SYSTEM_PROMPT = [
  "You are Tell, a personal global macro research assistant.",
  "Answer only from the provided evidence block.",
  "If evidence is missing, say what is unknown.",
  "Do not give financial advice, trade instructions, or guarantees.",
  "Keep answers concise and cite symbols/indicators when relevant.",
].join(" ");

export function sanitizeHistory(
  history: ChatMessage[] | undefined,
  limit = 6,
): ChatMessage[] {
  if (!history?.length) return [];
  return history
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-limit)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 2000),
    }));
}

export async function answerResearchQuestion(
  db: Client,
  options: {
    message: string;
    history?: ChatMessage[];
    symbol?: string | null;
    horizon?: string;
    chat?: typeof generateGroqChat;
  },
): Promise<ChatResult> {
  const message = options.message.trim().slice(0, 2000);
  if (!message) {
    throw new Error("message is required");
  }

  const context = await buildResearchContext(db, {
    symbol: options.symbol,
    horizon: options.horizon ?? "1d",
    query: message,
  });
  const evidence = formatResearchContext(context);
  const chat = options.chat ?? generateGroqChat;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `Evidence block:\n${evidence}`,
    },
    ...sanitizeHistory(options.history),
    { role: "user", content: message },
  ];

  const { text, model } = await chat(messages);

  return {
    answer: text,
    model,
    provider: "groq",
    citations: extractCitations(context),
    disclaimer: AI_DISCLAIMER,
  };
}
