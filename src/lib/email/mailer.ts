import nodemailer from "nodemailer";
import { isProductionLike } from "@/lib/config";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  useTls: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_LENGTH = 200;
const MAX_HTML_BYTES = 256 * 1024;
const MAX_TEXT_BYTES = 64 * 1024;

export function isEmailDeliveryEnabled(): boolean {
  const value = process.env.EMAIL_DELIVERY_ENABLED?.trim().toLowerCase();
  return !["0", "false", "no", "off"].includes(value ?? "");
}

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !user || !password || !from) return null;

  const configuredPort = Number(process.env.SMTP_PORT ?? "587");
  const port =
    Number.isInteger(configuredPort) &&
    configuredPort >= 1 &&
    configuredPort <= 65_535
      ? configuredPort
      : 587;
  const tlsDisabled =
    (process.env.SMTP_USE_TLS ?? "true").trim().toLowerCase() === "false";
  // Never allow plaintext SMTP in production-like environments.
  const useTls = isProductionLike() || !tlsDisabled;

  return {
    host,
    port,
    user,
    password,
    from,
    useTls,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() != null;
}

export function isEmailDeliveryAvailable(): boolean {
  return (
    process.env.TEST_MODE !== "1" &&
    isEmailDeliveryEnabled() &&
    isSmtpConfigured()
  );
}

function validateMessage(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): void {
  if (
    !EMAIL_RE.test(options.to) ||
    options.to.length > 254 ||
    /[\r\n]/.test(options.to)
  ) {
    throw new Error("Invalid email recipient");
  }
  if (
    !options.subject.trim() ||
    options.subject.length > MAX_SUBJECT_LENGTH ||
    /[\r\n]/.test(options.subject)
  ) {
    throw new Error("Invalid email subject");
  }
  if (Buffer.byteLength(options.html, "utf8") > MAX_HTML_BYTES) {
    throw new Error("Email HTML body is too large");
  }
  if (Buffer.byteLength(options.text, "utf8") > MAX_TEXT_BYTES) {
    throw new Error("Email text body is too large");
  }
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  if (process.env.TEST_MODE === "1") {
    return { sent: false, skipped: "Email disabled in test mode" };
  }
  if (!isEmailDeliveryEnabled()) {
    return { sent: false, skipped: "Email delivery disabled" };
  }

  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, skipped: "SMTP not configured" };
  }

  validateMessage(options);

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.useTls && config.port !== 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  await transporter.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });

  return { sent: true };
}
