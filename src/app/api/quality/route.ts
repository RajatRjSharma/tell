import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import { getQualityReport } from "@/lib/forecasts/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const symbol = request.nextUrl.searchParams.get("symbol");
    const report = await getQualityReport(getDb(), {
      symbol: symbol?.trim().toUpperCase() || null,
      recentLimit: 12,
    });

    return jsonOk({
      ...report,
      disclaimer:
        "Research aid only. Hit rates are historical and not guarantees.",
    });
  } catch (err) {
    console.error("quality error", err);
    return jsonError("Failed to load signal quality", 500);
  }
}
