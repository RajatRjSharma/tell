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
    const symbols = request.nextUrl.searchParams
      .get("symbols")
      ?.split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z0-9.=_-]{1,20}$/.test(value))
      .slice(0, 100);
    const report = await getQualityReport(getDb(), {
      symbol: symbol?.trim().toUpperCase() || null,
      symbols: symbol ? null : symbols,
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
