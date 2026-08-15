import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/config";
import { verifySession, type SessionPayload } from "@/lib/session-token";

const PUBLIC_EXACT = new Set([
  "/api/health",
  "/api/ready",
  "/api/auth/me",
  "/api/auth/config",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/otp/request",
  "/api/auth/otp/verify",
]);

export function normalizeApiPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname || "/";
}

/** Routes that may be called without a session (login, OTP, health). */
export function isPublicApiRoute(pathname: string, method: string): boolean {
  const path = normalizeApiPath(pathname);
  const verb = method.toUpperCase();

  if (path === "/api/health" || path === "/api/ready") {
    return verb === "GET" || verb === "HEAD";
  }
  if (path === "/api/auth/me") return verb === "GET" || verb === "HEAD";
  if (path === "/api/auth/config") return verb === "GET" || verb === "HEAD";
  if (path === "/api/auth/login") return verb === "POST";
  if (path === "/api/auth/logout") return verb === "POST";
  if (path === "/api/auth/register") return verb === "POST";
  if (path === "/api/auth/otp/request") return verb === "POST";
  if (path === "/api/auth/otp/verify") return verb === "POST";

  return PUBLIC_EXACT.has(path) && verb === "OPTIONS";
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export async function authenticateApiRequest(
  request: NextRequest | Request,
): Promise<SessionPayload | null> {
  const bearer = readBearerToken(request);
  if (bearer) {
    const session = await verifySession(bearer);
    if (session) return session;
  }

  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const cookieToken = request.cookies.get(sessionCookieName())?.value;
    if (cookieToken) {
      return verifySession(cookieToken);
    }
  }

  return null;
}

export function unauthorizedApiResponse(
  message = "Authentication required",
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    },
  );
}
