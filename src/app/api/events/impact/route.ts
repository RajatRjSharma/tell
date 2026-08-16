import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";
import {
  buildEventImpactReport,
  parseImpactHorizons,
} from "@/lib/events/impact";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const sp = request.nextUrl.searchParams;
    const source = sp.get("source")?.trim() || null;
    const symbol = sp.get("symbol")?.trim().toUpperCase() || null;
    const symbols = sp
      .get("symbols")
      ?.split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z0-9.=_-]{1,20}$/.test(value))
      .slice(0, 100);
    const sentimentRaw = (sp.get("sentiment") ?? "any").trim().toLowerCase();
    if (
      sentimentRaw !== "any" &&
      sentimentRaw !== "hawkish" &&
      sentimentRaw !== "dovish"
    ) {
      return jsonError("sentiment must be any, hawkish, or dovish", 400);
    }

    let horizons: string[];
    try {
      horizons = parseImpactHorizons(sp.get("horizons"));
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Invalid horizons",
        400,
      );
    }

    const report = await buildEventImpactReport(getDb(), {
      source,
      symbol,
      symbols: symbol ? null : symbols,
      horizons,
      sentimentFilter: sentimentRaw,
    });

    if (!report) {
      return jsonOk({
        report: null,
        message: "No matching policy events yet — run make ingest-events",
      });
    }

    return jsonOk({ report });
  } catch (err) {
    console.error("events impact error", err);
    return jsonError("Failed to compute event impact", 500);
  }
}
