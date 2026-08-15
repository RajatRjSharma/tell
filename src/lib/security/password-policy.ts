/** Password rules for registration (bcrypt truncates at 72 bytes). */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

const SPECIAL = /[^A-Za-z0-9]/;

const BANNED = new Set([
  "password123!",
  "password1234",
  "welcome123!",
  "changeme123!",
  "qwerty12345!",
  "letmein12345",
]);

export function validatePasswordStrength(
  password: string,
  options?: { email?: string },
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters`;
  }
  if (password.trim() !== password) {
    return "Password must not start or end with whitespace";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/\d/.test(password)) {
    return "Password must include a number";
  }
  if (!SPECIAL.test(password)) {
    return "Password must include a special character";
  }

  const lowered = password.toLowerCase();
  const emailLocal = options?.email?.toLowerCase().split("@")[0] ?? "";
  if (emailLocal.length >= 3 && lowered.includes(emailLocal)) {
    return "Password must not contain your email";
  }

  if (BANNED.has(lowered) || BANNED.has(lowered.replace(/!+$/, ""))) {
    return "Password is too common — choose a stronger one";
  }

  return null;
}
