import { NextResponse } from "next/server";
import { appUrl, isProductionLike } from "@/lib/config";
import { readBearerToken } from "@/lib/api/auth-guard";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOriginHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(requestHost: string | null): Set<string> {
  const hosts = new Set<string>();
  if (requestHost) hosts.add(requestHost.toLowerCase());
  const configured = parseOriginHost(appUrl());
  if (configured) hosts.add(configured);
  // Local development hosts
  hosts.add("localhost:3000");
  hosts.add("127.0.0.1:3000");
  return hosts;
}

/**
 * CSRF defense for cookie-authenticated browser requests.
 * Bearer tokens are not subject to classic CSRF and are skipped.
 */
export function enforceCsrf(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  // Authorization Bearer is not auto-attached by browsers cross-site.
  if (readBearerToken(request)) return null;

  const requestHost = request.headers.get("host");
  const allowed = allowedHosts(requestHost);

  const originHost = parseOriginHost(request.headers.get("origin"));
  if (originHost) {
    if (!allowed.has(originHost)) {
      return NextResponse.json(
        { error: "Cross-site request blocked" },
        { status: 403 },
      );
    }
    return null;
  }

  const refererHost = parseOriginHost(request.headers.get("referer"));
  if (refererHost) {
    if (!allowed.has(refererHost)) {
      return NextResponse.json(
        { error: "Cross-site request blocked" },
        { status: 403 },
      );
    }
    return null;
  }

  // Same-site navigations / some clients omit Origin. In production require
  // at least one of Origin or Referer for cookie-authenticated mutations.
  if (isProductionLike()) {
    return NextResponse.json(
      { error: "Missing Origin for state-changing request" },
      { status: 403 },
    );
  }

  return null;
}
