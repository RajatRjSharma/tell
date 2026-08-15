import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk, parseLimit } from "@/lib/api/http";
import { getMacroStrip } from "@/lib/macro/strip";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = parseLimit(
      request.nextUrl.searchParams.get("limit"),
      24,
      120,
    );
    const strip = await getMacroStrip(getDb(), { limit });
    return jsonOk({ strip });
  } catch (err) {
    console.error("macro strip error", err);
    return jsonError("Failed to load macro strip", 500);
  }
}
