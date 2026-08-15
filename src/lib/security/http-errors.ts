/** Client-facing error text — strip stacks, SQL, secrets. */

export const GENERIC_SERVER = "Something went wrong. Please try again.";
export const GENERIC_AI = "AI request failed. Please try again.";
export const GENERIC_AUTH = "Authentication failed.";

const LEAK_MARKERS = [
  "traceback",
  "stack trace",
  "exception:",
  " at line ",
  'file "',
  "file '/",
  "sqlalchemy",
  "sqlite",
  "libsql",
  "turso",
  "operationalerror",
  "psycopg",
  "asyncpg",
  "connection refused",
  "econnrefused",
  "enotfound",
  "getaddrinfo",
  "api key",
  "apikey",
  "secret",
  "password",
  "bearer ",
  "authorization:",
  "jwt_secret",
  "smtp",
  "gemini",
  "process.env",
  "node_modules",
];

const SAFE_PREFIXES = [
  "invalid",
  "missing",
  "required",
  "too many",
  "rate limit",
  "unauthorized",
  "forbidden",
  "not found",
  "already",
  "password",
  "email",
  "otp",
  "registration",
  "account",
  "horizon",
  "symbol",
  "name must",
  "question must",
];

function looksLikeLeak(text: string): boolean {
  const lower = text.toLowerCase();
  return LEAK_MARKERS.some((m) => lower.includes(m));
}

function looksUserSafe(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return SAFE_PREFIXES.some((p) => lower.startsWith(p) || lower.includes(p));
}

/** Map an exception to something safe to show the client. */
export function safePublicDetail(
  err: unknown,
  fallback: string = GENERIC_SERVER,
): string {
  if (err == null) return fallback;

  let message = "";
  if (typeof err === "string") message = err;
  else if (err instanceof Error) message = err.message;
  else return fallback;

  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 180) return fallback;
  if (looksLikeLeak(trimmed)) return fallback;
  if (
    !looksUserSafe(trimmed) &&
    !(err instanceof Error && err.name === "ZodError")
  ) {
    // Keep short validation messages.
    if (!/^[A-Za-z0-9][\w\s.,'"!?:;-]{2,179}$/.test(trimmed)) return fallback;
  }
  return trimmed;
}
