import type { NextRequest } from "next/server";
import { listResearchBriefs } from "@/lib/ai/store";
import { jsonError, jsonOk, parseLimit } from "@/lib/api/http";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const symbol = sp.get("symbol");
    const horizon = (sp.get("horizon") ?? "1d").toLowerCase();
    const limit = parseLimit(sp.get("limit"), 7, 30);

    if (!/^(1d|1w|1m|\d+d)$/.test(horizon)) {
      return jsonError("horizon must be 1d, 1w, 1m, or Nd", 400);
    }

    const briefs = await listResearchBriefs(getDb(), {
      symbol,
      horizon,
      limit,
    });

    return jsonOk({
      symbol: symbol?.trim().toUpperCase() || null,
      horizon,
      count: briefs.length,
      briefs,
      disclaimer:
        "Research aid only. Not financial advice or a guaranteed prediction.",
    });
  } catch (err) {
    console.error("brief history error", err);
    return jsonError("Failed to load brief history", 500);
  }
}
