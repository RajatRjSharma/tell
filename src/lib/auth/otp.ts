import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { LibsqlError, type Client, type Transaction } from "@libsql/client";
import { isProductionLike } from "@/lib/config";

export type OtpPurpose = "register";

export const REGISTER_CONFLICT_MESSAGE =
  "Unable to complete registration. Sign in if you already have an account, or try different details.";

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
  const pepper =
    process.env.OTP_PEPPER?.trim() || process.env.JWT_SECRET?.trim() || "";
  if (pepper) return pepper;
  if (isProductionLike()) {
    throw new Error("OTP_PEPPER or JWT_SECRET is required");
  }
  // Local/dev only — never used when APP_ENV is production-like.
  return "tell-otp-dev-pepper";
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
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

async function safeRollback(tx: Transaction) {
  if (!tx.closed) {
    await tx.rollback();
  }
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

  const tx = await db.transaction("write");
  try {
    await tx.execute({
      sql: `DELETE FROM auth_otps WHERE email = ? AND purpose = ?`,
      args: [options.email, options.purpose],
    });
    await tx.execute({
      sql: `INSERT INTO auth_otps (email, purpose, code_hash, expires_at, attempts)
            VALUES (?, ?, ?, ?, 0)`,
      args: [options.email, options.purpose, codeHash, expiresAt],
    });
    await tx.commit();
  } catch (err) {
    await safeRollback(tx);
    throw err;
  }

  return { expiresAt };
}

/**
 * Atomically verify OTP, enforce uniqueness, create the user, and consume the code.
 * Wrong codes increment attempts inside the same transaction.
 */
export async function registerAccountWithOtp(
  db: Client,
  options: {
    email: string;
    username: string;
    purpose: OtpPurpose;
    code: string;
    passwordHash: string;
    userId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: 400 | 409 }> {
  const tx = await db.transaction("write");
  try {
    const result = await tx.execute({
      sql: `SELECT id, code_hash, expires_at, attempts
            FROM auth_otps
            WHERE email = ? AND purpose = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [options.email, options.purpose],
    });

    const row = result.rows[0];
    if (!row) {
      hashOtp(options.code);
      await safeRollback(tx);
      return {
        ok: false,
        error: "No verification code found. Request a new one.",
        status: 400,
      };
    }

    const attempts = Number(row.attempts ?? 0);
    if (attempts >= 5) {
      await safeRollback(tx);
      return {
        ok: false,
        error: "Too many attempts. Request a new code.",
        status: 400,
      };
    }

    const expiresAt = String(row.expires_at);
    if (Date.parse(expiresAt) < Date.now()) {
      await safeRollback(tx);
      return {
        ok: false,
        error: "Code expired. Request a new one.",
        status: 400,
      };
    }

    const expected = String(row.code_hash);
    const incoming = hashOtp(options.code);
    if (!hashesEqual(expected, incoming)) {
      await tx.execute({
        sql: `UPDATE auth_otps SET attempts = attempts + 1 WHERE id = ? AND attempts < 5`,
        args: [Number(row.id)],
      });
      await tx.commit();
      return { ok: false, error: "Invalid verification code.", status: 400 };
    }

    const emailHit = await tx.execute({
      sql: "SELECT id FROM users WHERE email = ? LIMIT 1",
      args: [options.email],
    });
    const usernameHit = await tx.execute({
      sql: "SELECT id FROM users WHERE username = ? LIMIT 1",
      args: [options.username],
    });
    if (emailHit.rows.length > 0 || usernameHit.rows.length > 0) {
      await safeRollback(tx);
      return { ok: false, error: REGISTER_CONFLICT_MESSAGE, status: 409 };
    }

    await tx.execute({
      sql: `DELETE FROM auth_otps WHERE email = ? AND purpose = ?`,
      args: [options.email, options.purpose],
    });
    await tx.execute({
      sql: "INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)",
      args: [
        options.userId,
        options.email,
        options.username,
        options.passwordHash,
      ],
    });
    await tx.commit();
    return { ok: true };
  } catch (err) {
    await safeRollback(tx);
    if (err instanceof LibsqlError && /UNIQUE/i.test(err.message)) {
      return { ok: false, error: REGISTER_CONFLICT_MESSAGE, status: 409 };
    }
    throw err;
  }
}

/** @deprecated test helper */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
