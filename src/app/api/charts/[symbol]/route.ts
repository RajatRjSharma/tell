import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getChartSeries } from "@/lib/api/charts";
import {
  jsonError,
  jsonOk,
  parseLimit,
  parseOptionalDate,
} from "@/lib/api/http";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const { symbol: rawSymbol } = await context.params;
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9.=_-]{1,20}$/.test(symbol)) {
      return jsonError("Invalid symbol", 400);
    }

    const sp = request.nextUrl.searchParams;
    const from = parseOptionalDate(sp.get("from"));
    const to = parseOptionalDate(sp.get("to"));
    if (sp.get("from") && !from) {
      return jsonError("from must be YYYY-MM-DD", 400);
    }
    if (sp.get("to") && !to) {
      return jsonError("to must be YYYY-MM-DD", 400);
    }

    const horizon = sp.get("horizon")?.trim().toLowerCase() || null;
    if (horizon && !/^(1d|1w|1m|\d+d)$/.test(horizon)) {
      return jsonError("horizon must be 1d, 1w, 1m, or Nd", 400);
    }

    const limit = parseLimit(sp.get("limit"), 90, 400);
    const series = await getChartSeries(getDb(), {
      symbol,
      from,
      to,
      limit,
      horizon,
    });

    return jsonOk({
      ...series,
      count: series.bars.length,
      disclaimer:
        "Research aid only. Chart markers show historical signal dates.",
    });
  } catch (err) {
    console.error("charts error", err);
    return jsonError("Failed to load chart", 500);
  }
}
