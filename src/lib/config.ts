function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return defaultValue;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return defaultValue;
}

function envInt(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number },
): number {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  let value = Math.floor(n);
  if (options?.min != null) value = Math.max(options.min, value);
  if (options?.max != null) value = Math.min(options.max, value);
  return value;
}

export function appEnv(): string {
  return (process.env.APP_ENV ?? process.env.NODE_ENV ?? "local").trim();
}

export function isProductionLike(): boolean {
  const env = appEnv().toLowerCase();
  return (
    env === "production" ||
    env === "prod" ||
    process.env.NODE_ENV === "production"
  );
}

export function appUrl(): string {
  const raw = process.env.APP_URL?.trim();
  return raw && raw.length > 0
    ? raw.replace(/\/$/, "")
    : "https://tell-gamma.vercel.app";
}

/** Sign-up gate. Login still works when false. */
export function registrationEnabled(): boolean {
  return envFlag("REGISTRATION_ENABLED", true);
}

/** When false, OTP endpoints return 503. */
export function emailOtpEnabled(): boolean {
  return envFlag("EMAIL_OTP_ENABLED", true);
}

export function otpDevEchoEnabled(): boolean {
  return process.env.TELL_OTP_DEV_ECHO === "1";
}

export function sessionExpireDays(): number {
  return envInt("JWT_EXPIRE_DAYS", 14, { min: 1, max: 90 });
}

/** JWT issuer claim. */
export function jwtIssuer(): string {
  const raw = process.env.JWT_ISSUER?.trim();
  return raw && raw.length > 0 ? raw : "tell";
}

export function sessionCookieName(): string {
  const name = process.env.AUTH_COOKIE_NAME?.trim();
  return name && name.length > 0 ? name : "tell_session";
}

export function sessionCookieSameSite(): "lax" | "strict" | "none" {
  const raw = (process.env.AUTH_COOKIE_SAMESITE ?? "lax").trim().toLowerCase();
  if (raw === "strict" || raw === "none") return raw;
  return "lax";
}

export function sessionCookieSecure(): boolean {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  if (sessionCookieSameSite() === "none") return true;
  return isProductionLike();
}

export function authRateLimitPerMinute(): number {
  return envInt("AUTH_RATE_LIMIT_PER_MINUTE", 20, { min: 1, max: 600 });
}

export function briefRateLimitPerMinute(): number {
  return envInt("BRIEF_RATE_LIMIT_PER_MINUTE", 20, { min: 1, max: 120 });
}

export function chatRateLimitPerMinute(): number {
  return envInt("CHAT_RATE_LIMIT_PER_MINUTE", 20, { min: 1, max: 120 });
}

/** Read API rate limit. */
export function apiRateLimitPerMinute(): number {
  return envInt("API_RATE_LIMIT_PER_MINUTE", 60, { min: 1, max: 300 });
}

/** Watchlist / alerts write rate limit. */
export function writeRateLimitPerMinute(): number {
  return envInt("WRITE_RATE_LIMIT_PER_MINUTE", 30, { min: 1, max: 120 });
}

/** Health probe rate limit. */
export function healthRateLimitPerMinute(): number {
  return envInt("HEALTH_RATE_LIMIT_PER_MINUTE", 120, { min: 1, max: 600 });
}
