import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import { enforceAuthIdentityRateLimit } from "@/lib/api/rate-limit";
import {
  normalizeEmail,
  normalizeUsername,
  validateLoginCredentials,
  verifyPasswordOrPad,
} from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      username?: string;
      identifier?: string;
      password?: string;
    };

    const rawIdentifier = (
      body.identifier ??
      body.email ??
      body.username ??
      ""
    ).trim();
    const password = body.password ?? "";

    const identityLimited = enforceAuthIdentityRateLimit(
      request,
      rawIdentifier.toLowerCase(),
    );
    if (identityLimited) return identityLimited;

    const error = validateLoginCredentials(rawIdentifier, password);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const db = getDb();
    const byEmail = rawIdentifier.includes("@");
    const result = await db.execute({
      sql: byEmail
        ? "SELECT id, email, username, password_hash FROM users WHERE email = ?"
        : "SELECT id, email, username, password_hash FROM users WHERE username = ?",
      args: [
        byEmail
          ? normalizeEmail(rawIdentifier)
          : normalizeUsername(rawIdentifier),
      ],
    });

    const row = result.rows[0];
    const passwordHash = row ? String(row.password_hash) : null;
    const ok = await verifyPasswordOrPad(password, passwordHash);
    if (!row || !ok) {
      return NextResponse.json(
        { error: "Invalid email, username, or password" },
        { status: 401 },
      );
    }

    const id = String(row.id);
    const email = String(row.email);
    const username = String(row.username ?? "").trim();
    if (!username) {
      console.error("login error: user missing username", { id, email });
      return NextResponse.json({ error: "Login failed" }, { status: 500 });
    }

    const token = await signSession({ sub: id, email, username });
    await setSessionCookie(token);

    return NextResponse.json({ user: { id, email, username } });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
