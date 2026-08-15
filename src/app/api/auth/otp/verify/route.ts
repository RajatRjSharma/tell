import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import { consumeAuthOtp } from "@/lib/auth/otp";
import { emailOtpEnabled, registrationEnabled } from "@/lib/config";
import { enforceAuthIdentityRateLimit } from "@/lib/api/rate-limit";
import {
  hashPassword,
  normalizeEmail,
  validateRegisterCredentials,
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

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      otp?: string;
      password?: string;
      purpose?: string;
    } | null;

    const email = normalizeEmail(body?.email ?? "");
    const otp = (body?.otp ?? "").trim();
    const password = body?.password ?? "";
    const purpose = body?.purpose ?? "register";

    const identityLimited = enforceAuthIdentityRateLimit(request, email);
    if (identityLimited) return identityLimited;

    if (purpose !== "register") {
      return NextResponse.json(
        { error: "Unsupported purpose" },
        { status: 400 },
      );
    }

    const credentialsError = validateRegisterCredentials(email, password);
    if (credentialsError) {
      return NextResponse.json({ error: credentialsError }, { status: 400 });
    }
    if (!/^\d{4,8}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter the verification code from your email" },
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

    const consumed = await consumeAuthOtp(db, {
      email,
      purpose: "register",
      code: otp,
    });
    if (!consumed.ok) {
      return NextResponse.json({ error: consumed.error }, { status: 400 });
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    await db.execute({
      sql: "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
      args: [id, email, passwordHash],
    });

    const token = await signSession({ sub: id, email });
    await setSessionCookie(token);

    return NextResponse.json({ user: { id, email } }, { status: 201 });
  } catch (err) {
    console.error("otp verify error", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
