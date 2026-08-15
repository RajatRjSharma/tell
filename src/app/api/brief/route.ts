import type { NextRequest } from "next/server";
import { generateBrief } from "@/lib/ai/brief";
import { AiConfigError, AiProviderError } from "@/lib/ai/gemini";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import { GENERIC_AI, safePublicDetail } from "@/lib/security/http-errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
      return jsonError(safePublicDetail(err, GENERIC_AI), 503);
    }
    if (err instanceof AiProviderError) {
      return jsonError(
        safePublicDetail(err, GENERIC_AI),
        err.status >= 500 ? 502 : err.status,
      );
    }
    console.error("brief error", err);
    return jsonError("Failed to generate brief", 500);
  }
}
