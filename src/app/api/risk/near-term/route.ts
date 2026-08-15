import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getNearTermRiskBias } from "@/lib/risk/near-term";

export async function GET() {
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
