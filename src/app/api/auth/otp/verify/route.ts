import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import { registerAccountWithOtp } from "@/lib/auth/otp";
import { emailOtpEnabled, registrationEnabled } from "@/lib/config";
import { enforceAuthIdentityRateLimit } from "@/lib/api/rate-limit";
import {
  hashPassword,
  normalizeEmail,
  normalizeUsername,
  validateRegisterCredentials,
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

    const body = (await request.json().catch(() => null)) as {
      email?: string;
      username?: string;
      otp?: string;
      password?: string;
      confirmPassword?: string;
      purpose?: string;
    } | null;

    const email = normalizeEmail(body?.email ?? "");
    const username = normalizeUsername(body?.username ?? "");
    const otp = (body?.otp ?? "").trim();
    const password = body?.password ?? "";
    const confirmPassword = body?.confirmPassword ?? "";
    const purpose = body?.purpose ?? "register";

    const identityLimited = enforceAuthIdentityRateLimit(
      request,
      `otp:register:${email}`,
    );
    if (identityLimited) return identityLimited;

    if (purpose !== "register") {
      return NextResponse.json(
        { error: "Unsupported purpose" },
        { status: 400 },
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const credentialsError = validateRegisterCredentials(email, password, {
      username,
      confirmPassword,
    });
    if (credentialsError) {
      return NextResponse.json({ error: credentialsError }, { status: 400 });
    }
    if (!/^\d{4,8}$/.test(otp)) {
      return NextResponse.json(
        { error: "Enter the verification code from your email" },
        { status: 400 },
      );
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    const db = getDb();
    const registered = await registerAccountWithOtp(db, {
      email,
      username,
      purpose: "register",
      code: otp,
      passwordHash,
      userId: id,
    });
    if (!registered.ok) {
      return NextResponse.json(
        { error: registered.error },
        { status: registered.status },
      );
    }

    const token = await signSession({ sub: id, email, username });
    await setSessionCookie(token);

    return NextResponse.json(
      { user: { id, email, username } },
      { status: 201 },
    );
  } catch (err) {
    console.error("otp verify error", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
