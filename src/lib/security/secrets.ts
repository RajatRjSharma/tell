/** JWT secret strength for health checks. */

import { isProductionLike } from "@/lib/config";

export function jwtSecretStatus(): {
  present: boolean;
  strong: boolean;
  message: string;
} {
  const secret = process.env.JWT_SECRET?.trim() ?? "";
  if (!secret) {
    return {
      present: false,
      strong: false,
      message: "JWT_SECRET is missing",
    };
  }
  if (secret.length < 32) {
    return {
      present: true,
      strong: false,
      message: "JWT_SECRET should be at least 32 characters",
    };
  }
  if (/^(change-me|secret|password|test)/i.test(secret)) {
    return {
      present: true,
      strong: false,
      message: "JWT_SECRET looks like a placeholder",
    };
  }
  return {
    present: true,
    strong: true,
    message: "JWT_SECRET present and adequately long",
  };
}

export function assertJwtSecretForProduction(): void {
  if (!isProductionLike()) return;
  const status = jwtSecretStatus();
  if (!status.present || !status.strong) {
    throw new Error(status.message);
  }
}
