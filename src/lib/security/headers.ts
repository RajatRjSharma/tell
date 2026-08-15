export type SecurityHeader = { key: string; value: string };

function productionLike(): boolean {
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "local")
    .trim()
    .toLowerCase();
  return (
    env === "production" ||
    env === "prod" ||
    process.env.NODE_ENV === "production"
  );
}

/** Baseline browser security headers for all responses. */
export function securityHeaders(options?: { csp?: boolean }): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];

  if (options?.csp !== false) {
    headers.push({
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "manifest-src 'self'",
      ].join("; "),
    });
  }

  if (productionLike()) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

export function applySecurityHeaders(headers: Headers): void {
  for (const { key, value } of securityHeaders()) {
    if (!headers.has(key)) headers.set(key, value);
  }
}

export function apiCacheHeaders(pathname: string): SecurityHeader[] {
  if (pathname.startsWith("/api/auth")) {
    return [
      {
        key: "Cache-Control",
        value: "no-store, no-cache, must-revalidate, private",
      },
      { key: "Pragma", value: "no-cache" },
    ];
  }
  if (pathname === "/api/health" || pathname === "/api/ready") {
    return [{ key: "Cache-Control", value: "no-store" }];
  }
  return [{ key: "Cache-Control", value: "private, no-store" }];
}
