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
import {
  alreadyRegisteredEmailTemplate,
  otpEmailTemplate,
} from "@/lib/email/templates";
import { enforceAuthIdentityRateLimit } from "@/lib/api/rate-limit";
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validateUsername,
} from "@/lib/password";

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
      username?: string;
      purpose?: string;
    } | null;

    const email = normalizeEmail(body?.email ?? "");
    const username = normalizeUsername(body?.username ?? "");
    const purpose = body?.purpose ?? "register";

    const identityLimited = enforceAuthIdentityRateLimit(
      request,
      `otp:register:${email}`,
    );
    if (identityLimited) return identityLimited;

    const usernameLimited = enforceAuthIdentityRateLimit(
      request,
      `otp:username:${username}`,
    );
    if (usernameLimited) return usernameLimited;

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }
    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }
    if (purpose !== "register") {
      return NextResponse.json(
        { error: "Unsupported purpose" },
        { status: 400 },
      );
    }

    const db = getDb();
    const existingEmail = await db.execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    const existingUsername = await db.execute({
      sql: "SELECT id FROM users WHERE username = ?",
      args: [username],
    });
    const emailTaken = existingEmail.rows.length > 0;
    const usernameTaken = existingUsername.rows.length > 0;

    const expireMinutes = otpExpireMinutes();
    const expiresAt = new Date(
      Date.now() + expireMinutes * 60_000,
    ).toISOString();

    // Soft enumeration: same success shape whether the account exists or not.
    if (emailTaken || usernameTaken) {
      if (emailTaken && isEmailDeliveryAvailable()) {
        const notice = alreadyRegisteredEmailTemplate();
        await sendMail({
          to: email,
          subject: notice.subject,
          html: notice.html,
          text: notice.text,
        });
      }

      return NextResponse.json({
        ok: true,
        expiresAt,
        expireMinutes,
      });
    }

    const code = generateOtpCode();
    const created = await createAuthOtp(db, {
      email,
      purpose: "register",
      code,
    });

    const template = otpEmailTemplate({
      code,
      expireMinutes,
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
      expiresAt: created.expiresAt,
      expireMinutes,
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
