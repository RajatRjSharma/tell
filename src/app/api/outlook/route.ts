import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk, parseOptionalDate } from "@/lib/api/http";
import {
  getLatestAsOfDate,
  groupOutlookBySymbol,
  listLatestOutlook,
} from "@/lib/api/outlook";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const sp = request.nextUrl.searchParams;
    const asOfDate = parseOptionalDate(sp.get("asOf"));
    if (sp.get("asOf") && !asOfDate) {
      return jsonError("asOf must be YYYY-MM-DD", 400);
    }

    const symbols = sp
      .get("symbols")
      ?.split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const horizons = sp
      .get("horizons")
      ?.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const db = getDb();
    const rows = await listLatestOutlook(db, {
      asOfDate,
      symbols: symbols?.length ? symbols : null,
      horizons: horizons?.length ? horizons : null,
    });

    const latestAsOf = asOfDate ?? (await getLatestAsOfDate(db));

    return jsonOk({
      asOf: latestAsOf,
      modelVersion: SIGNAL_MODEL_VERSION,
      count: rows.length,
      bySymbol: groupOutlookBySymbol(rows),
      signals: rows,
      disclaimer:
        "Research aid only. Not financial advice or guaranteed predictions.",
    });
  } catch (err) {
    console.error("outlook error", err);
    return jsonError("Failed to load outlook", 500);
  }
}
