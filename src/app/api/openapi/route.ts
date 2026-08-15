import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import { appUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Public OpenAPI 3.0 document for Swagger UI. */
export async function GET(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
  const fromRequest = host ? `${proto}://${host}` : null;
  const doc = buildOpenApiDocument(fromRequest ?? appUrl());

  return NextResponse.json(doc, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
