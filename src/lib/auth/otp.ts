import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import type { Client } from "@libsql/client";

export type OtpPurpose = "register";

function otpLength(): number {
  const n = Number(process.env.OTP_LENGTH ?? "6");
  if (!Number.isFinite(n)) return 6;
  return Math.min(Math.max(Math.floor(n), 4), 8);
}

export function otpExpireMinutes(): number {
  const n = Number(process.env.OTP_EXPIRE_MINUTES ?? "10");
  if (!Number.isFinite(n)) return 10;
  return Math.min(Math.max(Math.floor(n), 5), 60);
}

function otpPepper(): string {
  return (
    process.env.OTP_PEPPER?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "tell-otp-dev-pepper"
  );
}

export function generateOtpCode(): string {
  const len = otpLength();
  const max = 10 ** len;
  return String(randomInt(0, max)).padStart(len, "0");
}

export function hashOtp(code: string): string {
  return createHmac("sha256", otpPepper()).update(code.trim()).digest("hex");
}

function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Timing pad on length mismatch.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function createAuthOtp(
  db: Client,
  options: {
    email: string;
    purpose: OtpPurpose;
    code: string;
  },
): Promise<{ expiresAt: string }> {
  const minutes = otpExpireMinutes();
  const expiresAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const codeHash = hashOtp(options.code);

  await db.execute({
    sql: `DELETE FROM auth_otps WHERE email = ? AND purpose = ?`,
    args: [options.email, options.purpose],
  });

  await db.execute({
    sql: `INSERT INTO auth_otps (email, purpose, code_hash, expires_at, attempts)
          VALUES (?, ?, ?, ?, 0)`,
    args: [options.email, options.purpose, codeHash, expiresAt],
  });

  return { expiresAt };
}

export async function consumeAuthOtp(
  db: Client,
  options: {
    email: string;
    purpose: OtpPurpose;
    code: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await db.execute({
    sql: `SELECT id, code_hash, expires_at, attempts
          FROM auth_otps
          WHERE email = ? AND purpose = ?
          ORDER BY created_at DESC
          LIMIT 1`,
    args: [options.email, options.purpose],
  });

  const row = result.rows[0];
  if (!row) {
    // Timing pad for miss path.
    hashOtp(options.code);
    return {
      ok: false,
      error: "No verification code found. Request a new one.",
    };
  }

  const attempts = Number(row.attempts ?? 0);
  if (attempts >= 5) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const expiresAt = String(row.expires_at);
  if (Date.parse(expiresAt) < Date.now()) {
    return { ok: false, error: "Code expired. Request a new one." };
  }

  const expected = String(row.code_hash);
  const incoming = hashOtp(options.code);
  if (!hashesEqual(expected, incoming)) {
    await db.execute({
      sql: `UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ?`,
      args: [Number(row.id)],
    });
    return { ok: false, error: "Invalid verification code." };
  }

  await db.execute({
    sql: `DELETE FROM auth_otps WHERE email = ? AND purpose = ?`,
    args: [options.email, options.purpose],
  });

  return { ok: true };
}

/** @deprecated test helper */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
