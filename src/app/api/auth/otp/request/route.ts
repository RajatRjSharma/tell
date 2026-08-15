import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createAuthOtp,
  generateOtpCode,
  otpExpireMinutes,
} from "@/lib/auth/otp";
import {
  emailOtpEnabled,
  otpDevEchoEnabled,
  registrationEnabled,
} from "@/lib/config";
import { isEmailDeliveryAvailable, sendMail } from "@/lib/email/mailer";
import { otpEmailTemplate } from "@/lib/email/templates";
import { enforceAuthIdentityRateLimit } from "@/lib/api/rate-limit";
import { normalizeEmail } from "@/lib/password";

export async function POST(request: Request) {
  try {
    if (!registrationEnabled()) {
      return NextResponse.json(
        { error: "Registration is currently closed" },
        { status: 403 },
      );
    }

    if (!emailOtpEnabled()) {
      return NextResponse.json(
        { error: "Email verification is disabled on this server" },
        { status: 503 },
      );
    }

    const echo = otpDevEchoEnabled();
    if (!isEmailDeliveryAvailable() && !echo) {
      return NextResponse.json(
        { error: "Email delivery is not configured on this server" },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      purpose?: string;
    } | null;

    const email = normalizeEmail(body?.email ?? "");
    const purpose = body?.purpose ?? "register";

    const identityLimited = enforceAuthIdentityRateLimit(request, email);
    if (identityLimited) return identityLimited;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    }
    if (purpose !== "register") {
      return NextResponse.json(
        { error: "Unsupported purpose" },
        { status: 400 },
      );
    }

    const db = getDb();
    const existing = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    const code = generateOtpCode();
    const { expiresAt } = await createAuthOtp(db, {
      email,
      purpose: "register",
      code,
    });

    const template = otpEmailTemplate({
      code,
      expireMinutes: otpExpireMinutes(),
    });

    if (isEmailDeliveryAvailable()) {
      await sendMail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    }

    return NextResponse.json({
      ok: true,
      expiresAt,
      expireMinutes: otpExpireMinutes(),
      ...(echo ? { devCode: code } : {}),
    });
  } catch (err) {
    console.error("otp request error", err);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 },
    );
  }
}
