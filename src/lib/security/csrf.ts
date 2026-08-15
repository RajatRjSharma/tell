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
  // Dev localhost origins.
  hosts.add("localhost:3000");
  hosts.add("127.0.0.1:3000");
  return hosts;
}

/**
 * CSRF check for cookie-auth mutating requests.
 * Bearer requests skip this.
 */
export function enforceCsrf(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return null;

  // Bearer auth isn't CSRF-prone the way cookies are.
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

  // Prod: require Origin or Referer on cookie mutations.
  if (isProductionLike()) {
    return NextResponse.json(
      { error: "Missing Origin for state-changing request" },
      { status: 403 },
    );
  }

  return null;
}
