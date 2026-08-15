import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { jwtIssuer, sessionExpireDays } from "@/lib/config";

export type SessionPayload = {
  sub: string;
  email: string;
  username: string;
};

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const days = sessionExpireDays();
  return new SignJWT({
    email: payload.email,
    username: payload.username,
    type: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(jwtIssuer())
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getSecret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: jwtIssuer(),
      algorithms: ["HS256"],
      requiredClaims: ["sub", "exp", "iat", "iss"],
    });
    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    if (payload.type != null && payload.type !== "session") return null;
    const username =
      typeof payload.username === "string" && payload.username.length > 0
        ? payload.username
        : email.split("@")[0] ?? "user";
    return { sub, email, username };
  } catch {
    return null;
  }
}
