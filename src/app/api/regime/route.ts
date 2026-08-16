import { jsonError, jsonOk } from "@/lib/api/http";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { getRegimeExplainer } from "@/lib/features/regime-snapshot";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const asOf = request.nextUrl.searchParams.get("asOf")?.trim() || undefined;
    const explainer = await getRegimeExplainer(getDb(), { asOf });
    return jsonOk({ explainer });
  } catch (err) {
    console.error("regime explainer error", err);
    return jsonError("Failed to load regime explainer", 500);
  }
}
