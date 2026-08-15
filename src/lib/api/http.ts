import { NextResponse } from "next/server";

export function jsonOk<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit },
) {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

export function jsonError(
  error: string,
  status = 400,
  extras?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extras }, { status });
}

/** Clamp limit query params. */
export function parseLimit(
  raw: string | null,
  fallback: number,
  max: number,
): number {
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

export function parseOptionalDate(raw: string | null): string | null {
  if (raw == null || raw === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}
