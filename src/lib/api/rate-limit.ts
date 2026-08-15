import { rateLimit } from "@/lib/ai/rate-limit";
import {
  apiRateLimitPerMinute,
  authRateLimitPerMinute,
  briefRateLimitPerMinute,
  chatRateLimitPerMinute,
  healthRateLimitPerMinute,
  writeRateLimitPerMinute,
} from "@/lib/config";
import { NextResponse } from "next/server";

export type RateLimitCategory =
  "health" | "auth" | "brief" | "chat" | "write" | "api";

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "anonymous";
}

export function resolveRateLimitCategory(
  pathname: string,
  method: string,
): RateLimitCategory {
  const path = pathname.replace(/\/+$/, "") || "/";
  const verb = method.toUpperCase();

  if (path === "/api/health" || path === "/api/ready") return "health";
  if (path.startsWith("/api/auth")) return "auth";
  if (path === "/api/brief" || path.startsWith("/api/brief/")) return "brief";
  if (path === "/api/chat") return "chat";

  const isWrite =
    verb === "POST" || verb === "PUT" || verb === "PATCH" || verb === "DELETE";
  if (
    isWrite &&
    (path.startsWith("/api/watchlist") || path.startsWith("/api/alerts"))
  ) {
    return "write";
  }

  return "api";
}

export function rateLimitForCategory(category: RateLimitCategory): number {
  switch (category) {
    case "health":
      return healthRateLimitPerMinute();
    case "auth":
      return authRateLimitPerMinute();
    case "brief":
      return briefRateLimitPerMinute();
    case "chat":
      return chatRateLimitPerMinute();
    case "write":
      return writeRateLimitPerMinute();
    default:
      return apiRateLimitPerMinute();
  }
}

function rateLimitMessage(category: RateLimitCategory): string {
  switch (category) {
    case "auth":
      return "Too many auth requests. Try again shortly.";
    case "brief":
      return "Too many brief requests";
    case "chat":
      return "Too many chat requests";
    case "write":
      return "Too many write requests. Try again shortly.";
    case "health":
      return "Too many health checks. Try again shortly.";
    default:
      return "Too many requests. Try again shortly.";
  }
}

export function enforceRateLimit(
  request: Request,
  options?: { pathname?: string; category?: RateLimitCategory },
): NextResponse | null {
  if (process.env.TEST_MODE === "1") return null;

  const url = new URL(request.url);
  const pathname = options?.pathname ?? url.pathname;
  const category =
    options?.category ?? resolveRateLimitCategory(pathname, request.method);
  const limit = rateLimitForCategory(category);
  const key = `${category}:${clientKey(request)}`;
  const result = rateLimit(key, limit, 60_000);

  if (result.ok) return null;

  return NextResponse.json(
    {
      error: rateLimitMessage(category),
      retryAfterSec: result.retryAfterSec,
      category,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}

/** @deprecated use enforceRateLimit */
export function enforceAuthRateLimit(request: Request): NextResponse | null {
  return enforceRateLimit(request, { category: "auth" });
}

/** Per-email/user auth rate limit (on top of per-IP). */
export function enforceAuthIdentityRateLimit(
  request: Request,
  identity: string,
): NextResponse | null {
  if (process.env.TEST_MODE === "1") return null;

  const normalized = identity.trim().toLowerCase().slice(0, 254);
  if (!normalized) return null;

  const limit = authRateLimitPerMinute();
  const result = rateLimit(`auth:id:${normalized}`, limit, 60_000);
  if (result.ok) return null;

  return NextResponse.json(
    {
      error: rateLimitMessage("auth"),
      retryAfterSec: result.retryAfterSec,
      category: "auth",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSec) },
    },
  );
}
