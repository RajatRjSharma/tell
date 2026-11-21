import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getMarketMap } from "@/lib/market-map";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    return jsonOk(await getMarketMap(getDb()));
  } catch (err) {
    console.error("market map error", err);
    return jsonError("Failed to load market map", 500);
  }
}
