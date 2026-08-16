import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
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
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const sp = request.nextUrl.searchParams;
    const limit = parseLimit(sp.get("limit"), 30, 100);
    const countryCode = sp.get("country")?.trim().toUpperCase() || null;
    const countryCodes = sp
      .get("countries")
      ?.split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value))
      .slice(0, 50);
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
      countryCodes: countryCode ? null : countryCodes,
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
