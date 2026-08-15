import { NextResponse } from "next/server";

const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

/** Reject obscure / dangerous HTTP methods early. */
export function enforceAllowedMethod(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (ALLOWED_METHODS.has(method)) return null;
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405, headers: { Allow: "GET, HEAD, POST, PUT, PATCH, DELETE" } },
  );
}

/**
 * Soft body-size guard using Content-Length when present.
 * Default 256 KiB is enough for auth / chat payloads.
 */
export function enforceBodySize(
  request: Request,
  maxBytes = 256 * 1024,
): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const raw = request.headers.get("content-length");
  if (!raw) return null;
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0) {
    return NextResponse.json(
      { error: "Invalid Content-Length" },
      { status: 400 },
    );
  }
  if (length > maxBytes) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413 },
    );
  }
  return null;
}

export function requireJsonContentType(request: Request): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const lengthHeader = request.headers.get("content-length");
  const length = lengthHeader == null ? null : Number(lengthHeader);
  const contentType = request.headers.get("content-type");

  // Empty-body POSTs (e.g. logout) are allowed without a Content-Type.
  if ((length === 0 || lengthHeader == null) && !contentType) {
    return null;
  }
  if (length === 0 && contentType == null) {
    return null;
  }

  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }
  return null;
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
