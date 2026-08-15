import { readBearerToken } from "@/lib/api/auth-guard";
import {
  sessionCookieName,
  sessionCookieSameSite,
  sessionCookieSecure,
  sessionExpireDays,
} from "@/lib/config";
import { cookies } from "next/headers";
import {
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session-token";

export type { SessionPayload };
export { signSession, verifySession };

export function getSessionCookieName(): string {
  return sessionCookieName();
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  const days = sessionExpireDays();
  jar.set(sessionCookieName(), token, {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: sessionCookieSameSite(),
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(sessionCookieName(), "", {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: sessionCookieSameSite(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(sessionCookieName())?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Session from cookie or Bearer token. */
export async function getRequestSession(
  request: Request,
): Promise<SessionPayload | null> {
  const bearer = readBearerToken(request);
  if (bearer) {
    const session = await verifySession(bearer);
    if (session) return session;
  }
  return getSession();
}
