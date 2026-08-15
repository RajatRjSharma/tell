import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import {
  jsonError,
  jsonOk,
  parseLimit,
  parseOptionalDate,
} from "@/lib/api/http";
import { listEvents } from "@/lib/events/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limit = parseLimit(sp.get("limit"), 30, 100);
    const countryCode = sp.get("country")?.trim().toUpperCase() || null;
    const source = sp.get("source")?.trim() || null;
    const symbol = sp.get("symbol")?.trim().toUpperCase() || null;
    const sinceRaw = sp.get("since");
    const since = parseOptionalDate(sinceRaw);
    if (sinceRaw && !since) {
      return jsonError("since must be YYYY-MM-DD", 400);
    }

    const events = await listEvents(getDb(), {
      limit,
      countryCode,
      source,
      since,
      symbol,
    });

    return jsonOk({
      count: events.length,
      events,
    });
  } catch (err) {
    console.error("events list error", err);
    return jsonError("Failed to load events", 500);
  }
}
