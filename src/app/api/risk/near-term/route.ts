import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { getNearTermRiskBias } from "@/lib/risk/near-term";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const symbols = request.nextUrl.searchParams
      .get("symbols")
      ?.split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => /^[A-Z0-9.=_-]{1,20}$/.test(value))
      .slice(0, 100);
    const bias = await getNearTermRiskBias(getDb(), { symbols });
    return NextResponse.json(bias);
  } catch (error) {
    console.error("near-term bias error", error);
    return NextResponse.json(
      { error: "Failed to compute near-term bias" },
      { status: 500 },
    );
  }
}
