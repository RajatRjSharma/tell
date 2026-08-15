import nodemailer from "nodemailer";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  useTls: boolean;
};

export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !user || !password || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? "587");
  const useTls = (process.env.SMTP_USE_TLS ?? "true").toLowerCase() !== "false";

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user,
    password,
    from,
    useTls,
  };
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() != null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const config = getSmtpConfig();
  if (!config) {
    return { sent: false, skipped: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.useTls && config.port !== 465,
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
  });

  return { sent: true };
}
