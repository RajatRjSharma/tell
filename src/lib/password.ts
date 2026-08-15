import bcrypt from "bcryptjs";
import {
  PASSWORD_MAX_LENGTH,
  validatePasswordStrength,
} from "@/lib/security/password-policy";

/** Login vs register password rules differ (legacy accounts). */
const LOGIN_MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return "Enter a valid email address";
  }
  return null;
}

/** Light checks for login. */
export function validateCredentials(
  email: string,
  password: string,
): string | null {
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (password.length < LOGIN_MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${LOGIN_MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  return null;
}

/** Stronger checks for new accounts. */
export function validateRegisterCredentials(
  email: string,
  password: string,
): string | null {
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  return validatePasswordStrength(password, { email });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (!passwordHash || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}
