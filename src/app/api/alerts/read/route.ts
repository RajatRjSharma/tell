import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import { markAlertEventsRead } from "@/lib/alerts/store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return jsonError("Sign in to update alerts", 401);
    }

    const body = (await request.json().catch(() => null)) as {
      all?: boolean;
      eventIds?: number[];
    } | null;

    if (!body?.all && (!body?.eventIds || body.eventIds.length === 0)) {
      return jsonError("Provide all=true or eventIds", 400);
    }

    const updated = await markAlertEventsRead(getDb(), session.sub, {
      all: Boolean(body?.all),
      eventIds: body?.eventIds,
    });

    return jsonOk({ updated });
  } catch (err) {
    console.error("alerts read error", err);
    return jsonError("Failed to mark alerts read", 500);
  }
}
