import type { NextRequest } from "next/server";
import { generateBrief } from "@/lib/ai/brief";
import { AiConfigError, AiProviderError } from "@/lib/ai/gemini";
import { rateLimit } from "@/lib/ai/rate-limit";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(`brief:${clientKey(request)}`, 20, 60_000);
  if (!limited.ok) {
    return jsonError("Too many brief requests", 429, {
      retryAfterSec: limited.retryAfterSec,
    });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const symbol = sp.get("symbol");
    const horizon = (sp.get("horizon") ?? "1d").toLowerCase();
    const refresh = sp.get("refresh") === "1";

    if (!/^(1d|1w|1m|\d+d)$/.test(horizon)) {
      return jsonError("horizon must be 1d, 1w, 1m, or Nd", 400);
    }

    const brief = await generateBrief(getDb(), {
      symbol,
      horizon,
      refresh,
    });

    return jsonOk(brief);
  } catch (err) {
    if (err instanceof AiConfigError) {
      return jsonError(err.message, 503);
    }
    if (err instanceof AiProviderError) {
      return jsonError(err.message, err.status >= 500 ? 502 : err.status);
    }
    console.error("brief error", err);
    return jsonError("Failed to generate brief", 500);
  }
}
