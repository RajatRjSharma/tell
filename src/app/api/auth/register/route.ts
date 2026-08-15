import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { setSessionCookie, signSession } from "@/lib/auth";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
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
    console.error("register error", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
