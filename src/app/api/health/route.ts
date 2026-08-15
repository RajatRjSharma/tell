import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { buildHealthReport, healthHttpStatus } from "@/lib/api/health";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * Health check.
 * Default: config + db + counts. `?deep=1` also probes Yahoo/Finnhub.
 */
export async function GET(request: NextRequest) {
  const deep =
    request.nextUrl.searchParams.get("deep") === "1" ||
    request.nextUrl.searchParams.get("deep") === "true";

  let db = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }

  const report = await buildHealthReport(db, {
    deep,
    version: packageJson.version,
  });

  return NextResponse.json(report, { status: healthHttpStatus(report) });
}
