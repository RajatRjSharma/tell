import bcrypt from "bcryptjs";
import {
  PASSWORD_MAX_LENGTH,
  validatePasswordStrength,
} from "@/lib/security/password-policy";

/** Login vs register password rules differ (legacy accounts). */
const LOGIN_MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z][a-z0-9_]{2,31}$/;
const BCRYPT_ROUNDS = 12;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return "Enter a valid email address";
  }
  return null;
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return "Username must be 3–32 chars: start with a letter, then letters, numbers, or _";
  }
  return null;
}

/** Login accepts email or username in one field. */
export function validateLoginCredentials(
  identifier: string,
  password: string,
): string | null {
  const value = identifier.trim();
  if (!value) {
    return "Enter your email or username";
  }
  if (value.includes("@")) {
    const emailError = validateEmail(normalizeEmail(value));
    if (emailError) return emailError;
  } else {
    const usernameError = validateUsername(normalizeUsername(value));
    if (usernameError) return usernameError;
  }
  if (password.length < LOGIN_MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${LOGIN_MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  return null;
}

/** @deprecated use validateLoginCredentials */
export function validateCredentials(
  email: string,
  password: string,
): string | null {
  return validateLoginCredentials(email, password);
}

/** Stronger checks for new accounts. */
export function validateRegisterCredentials(
  email: string,
  password: string,
  options?: { username?: string; confirmPassword?: string },
): string | null {
  const emailError = validateEmail(email);
  if (emailError) return emailError;
  if (options?.username != null) {
    const usernameError = validateUsername(options.username);
    if (usernameError) return usernameError;
  }
  if (
    options?.confirmPassword != null &&
    password !== options.confirmPassword
  ) {
    return "Passwords do not match";
  }
  return validatePasswordStrength(password, {
    email,
    username: options?.username,
  });
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
