import type { Client } from "@libsql/client";
import { cacheGet, cacheSet } from "@/lib/ai/cache";
import { buildResearchContext, formatResearchContext } from "@/lib/ai/context";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  AI_DISCLAIMER,
  type BriefResult,
  type ResearchContext,
} from "@/lib/ai/types";

const BRIEF_TTL_MS = 15 * 60 * 1000;

export function buildBriefPrompt(context: ResearchContext): string {
  const focus =
    context.symbol == null
      ? "Write a concise cross-asset market brief."
      : `Write a concise research brief focused on ${context.symbol}.`;

  return [
    "You are Tell, a macro research assistant.",
    "Use only the provided evidence. Do not invent data.",
    "Never give trade instructions, position sizes, or guarantees.",
    "Keep tone precise and editorial.",
    "",
    focus,
    "Return strict JSON with keys:",
    "title (string), summary (string, 2-3 sentences), bullets (string[3-5]), risks (string[2-3]).",
    "",
    "Evidence:",
    formatResearchContext(context),
  ].join("\n");
}

export function parseBriefJson(
  raw: string,
  meta: {
    model: string;
    asOf: string | null;
    symbol: string | null;
    horizon: string;
    cached: boolean;
  },
): BriefResult {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return {
      title: meta.symbol
        ? `${meta.symbol} research brief`
        : "Market research brief",
      summary: cleaned.slice(0, 600),
      bullets: [],
      risks: ["Model returned free-form text instead of structured JSON."],
      model: meta.model,
      provider: "gemini",
      asOf: meta.asOf,
      symbol: meta.symbol,
      horizon: meta.horizon,
      cached: meta.cached,
      disclaimer: AI_DISCLAIMER,
    };
  }

  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.filter((item): item is string => typeof item === "string")
    : [];
  const risks = Array.isArray(parsed.risks)
    ? parsed.risks.filter((item): item is string => typeof item === "string")
    : [];

  return {
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim()
        : meta.symbol
          ? `${meta.symbol} research brief`
          : "Market research brief",
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "No summary produced.",
    bullets: bullets.slice(0, 6),
    risks: risks.slice(0, 4),
    model: meta.model,
    provider: "gemini",
    asOf: meta.asOf,
    symbol: meta.symbol,
    horizon: meta.horizon,
    cached: meta.cached,
    disclaimer: AI_DISCLAIMER,
  };
}

export async function generateBrief(
  db: Client,
  options?: {
    symbol?: string | null;
    horizon?: string;
    refresh?: boolean;
    generate?: typeof generateGeminiText;
  },
): Promise<BriefResult> {
  const symbol = options?.symbol?.trim().toUpperCase() || null;
  const horizon = options?.horizon ?? "1d";
  const cacheKey = `brief:${symbol ?? "market"}:${horizon}`;

  if (!options?.refresh) {
    const cached = cacheGet<BriefResult>(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const context = await buildResearchContext(db, { symbol, horizon });
  const generate = options?.generate ?? generateGeminiText;
  const { text, model } = await generate(buildBriefPrompt(context));
  const brief = parseBriefJson(text, {
    model,
    asOf: context.asOf,
    symbol,
    horizon,
    cached: false,
  });

  cacheSet(cacheKey, { ...brief, cached: false }, BRIEF_TTL_MS);
  return brief;
}
