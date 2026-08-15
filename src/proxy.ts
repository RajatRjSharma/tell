import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  authenticateApiRequest,
  isPublicApiRoute,
  isPublicPageRoute,
  unauthorizedApiResponse,
} from "@/lib/api/auth-guard";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { enforceCsrf } from "@/lib/security/csrf";
import { apiCacheHeaders, applySecurityHeaders } from "@/lib/security/headers";
import {
  enforceAllowedMethod,
  enforceBodySize,
  newRequestId,
  requireJsonContentType,
} from "@/lib/security/request";
import { assertAuthConfigForProduction } from "@/lib/security/secrets";

let productionAuthChecked = false;

function ensureProductionAuthConfig() {
  if (productionAuthChecked) return;
  productionAuthChecked = true;
  assertAuthConfigForProduction();
}

function withCommonHeaders(
  response: NextResponse,
  request: NextRequest,
  requestId: string,
): NextResponse {
  applySecurityHeaders(response.headers);
  response.headers.set("X-Request-Id", requestId);
  if (request.nextUrl.pathname.startsWith("/api/")) {
    for (const { key, value } of apiCacheHeaders(request.nextUrl.pathname)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (next && next !== "/" && next !== "/login") {
    url.searchParams.set("next", next);
  }
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  ensureProductionAuthConfig();
  const requestId = newRequestId();

  if (!request.nextUrl.pathname.startsWith("/api/")) {
    const path = request.nextUrl.pathname;
    if (!isPublicPageRoute(path)) {
      const session = await authenticateApiRequest(request);
      if (!session) {
        return withCommonHeaders(loginRedirect(request), request, requestId);
      }
    } else if (path === "/login" || path === "/register") {
      const session = await authenticateApiRequest(request);
      if (session) {
        const home = request.nextUrl.clone();
        home.pathname = "/";
        home.search = "";
        return withCommonHeaders(
          NextResponse.redirect(home),
          request,
          requestId,
        );
      }
    }
    const response = NextResponse.next();
    return withCommonHeaders(response, request, requestId);
  }

  const methodBlock = enforceAllowedMethod(request);
  if (methodBlock) return withCommonHeaders(methodBlock, request, requestId);

  const sizeBlock = enforceBodySize(request);
  if (sizeBlock) return withCommonHeaders(sizeBlock, request, requestId);

  const limited = enforceRateLimit(request, {
    pathname: request.nextUrl.pathname,
  });
  if (limited) return withCommonHeaders(limited, request, requestId);

  const csrfBlock = enforceCsrf(request);
  if (csrfBlock) return withCommonHeaders(csrfBlock, request, requestId);

  const method = request.method.toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    const typeBlock = requireJsonContentType(request);
    if (typeBlock) return withCommonHeaders(typeBlock, request, requestId);
  }

  if (!isPublicApiRoute(request.nextUrl.pathname, request.method)) {
    const session = await authenticateApiRequest(request);
    if (!session) {
      return withCommonHeaders(unauthorizedApiResponse(), request, requestId);
    }
  }

  const response = NextResponse.next();
  return withCommonHeaders(response, request, requestId);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
