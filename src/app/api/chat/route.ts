import type { NextRequest } from "next/server";
import { answerResearchQuestion } from "@/lib/ai/chat";
import { AiConfigError, AiProviderError } from "@/lib/ai/gemini";
import type { ChatMessage } from "@/lib/ai/types";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import { GENERIC_AI, safePublicDetail } from "@/lib/security/http-errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const body = (await request.json()) as {
      message?: unknown;
      history?: unknown;
      symbol?: unknown;
      horizon?: unknown;
    };

    if (typeof body.message !== "string" || !body.message.trim()) {
      return jsonError("message is required", 400);
    }

    const history = Array.isArray(body.history)
      ? (body.history as ChatMessage[])
      : undefined;
    const symbol =
      typeof body.symbol === "string" && body.symbol.trim()
        ? body.symbol.trim().toUpperCase()
        : null;
    const horizon =
      typeof body.horizon === "string" && body.horizon.trim()
        ? body.horizon.trim().toLowerCase()
        : "1d";

    if (!/^(1d|1w|1m|\d+d)$/.test(horizon)) {
      return jsonError("horizon must be 1d, 1w, 1m, or Nd", 400);
    }

    const result = await answerResearchQuestion(getDb(), {
      message: body.message,
      history,
      symbol,
      horizon,
    });

    return jsonOk(result);
  } catch (err) {
    if (err instanceof AiConfigError) {
      return jsonError(safePublicDetail(err, GENERIC_AI), 503);
    }
    if (err instanceof AiProviderError) {
      return jsonError(
        safePublicDetail(err, GENERIC_AI),
        err.status >= 500 ? 502 : err.status,
      );
    }
    if (err instanceof Error && err.message === "message is required") {
      return jsonError(err.message, 400);
    }
    console.error("chat error", err);
    return jsonError("Failed to answer question", 500);
  }
}
