import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  jsonError,
  jsonOk,
  parseLimit,
  parseOptionalDate,
} from "@/lib/api/http";
import { listReadings } from "@/lib/api/readings-query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const countryCode = (sp.get("country") ?? "").trim().toUpperCase();
    const indicatorId = (sp.get("indicator") ?? "").trim().toUpperCase();

    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      return jsonError("Query country=XX (ISO-2) is required", 400);
    }
    if (!indicatorId || !/^[A-Z0-9_]{2,32}$/.test(indicatorId)) {
      return jsonError("Query indicator=ID is required", 400);
    }

    const from = parseOptionalDate(sp.get("from"));
    const to = parseOptionalDate(sp.get("to"));
    if (sp.get("from") && !from) {
      return jsonError("from must be YYYY-MM-DD", 400);
    }
    if (sp.get("to") && !to) {
      return jsonError("to must be YYYY-MM-DD", 400);
    }

    const limit = parseLimit(sp.get("limit"), 120, 2000);
    const db = getDb();
    const readings = await listReadings(db, {
      countryCode,
      indicatorId,
      from,
      to,
      limit,
    });

    return jsonOk({
      countryCode,
      indicatorId,
      count: readings.length,
      readings,
    });
  } catch (err) {
    console.error("readings error", err);
    return jsonError("Failed to load readings", 500);
  }
}
