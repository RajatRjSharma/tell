import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import {
  normalizeEmail,
  validateCredentials,
  verifyPassword,
} from "@/lib/password";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    const error = validateCredentials(email, password);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: "SELECT id, email, password_hash FROM users WHERE email = ?",
      args: [email],
    });

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, String(row.password_hash));
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const id = String(row.id);
    const token = await signSession({ sub: id, email: String(row.email) });
    await setSessionCookie(token);

    return NextResponse.json({ user: { id, email: String(row.email) } });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
