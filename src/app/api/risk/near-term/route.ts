import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { getNearTermRiskBias } from "@/lib/risk/near-term";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const bias = await getNearTermRiskBias(getDb());
    return NextResponse.json(bias);
  } catch (error) {
    console.error("near-term bias error", error);
    return NextResponse.json(
      { error: "Failed to compute near-term bias" },
      { status: 500 },
    );
  }
}
