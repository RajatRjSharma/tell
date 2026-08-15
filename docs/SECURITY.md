# Security

Tell’s security baseline for authentication, APIs, headers, and operational hygiene.

## Threat model (summary)

| Asset | Risk if compromised |
| ----- | ------------------- |
| Turso database | Macro history, signals, user emails and password hashes, alerts |
| `JWT_SECRET` | Session forgery for any account |
| SMTP credentials | Account takeover via OTP interception / spam |
| Provider API keys | Quota abuse, cost, data exfiltration from third parties |

Assume the browser is hostile, the network may be observed, and application logs are not a secret store.

## Controls in place

### Transport and browser

- HTTPS in production (Vercel); `Strict-Transport-Security` when `APP_ENV` / `NODE_ENV` is production-like
- Security headers on all responses (`src/lib/security/headers.ts`, `next.config.ts`):
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` (camera/mic/geo disabled)
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Resource-Policy: same-origin`
- `poweredByHeader: false` (no `X-Powered-By`)
- API responses use `Cache-Control: private, no-store` (stricter on `/api/auth/*`)

### Authentication

- Passwords: bcrypt cost 12; login length 8–72; **registration** requires 12+ with upper/lower/digit/special (OUTSKILL-style policy)
- Sessions: HS256 JWT in httpOnly cookie with `iss` (`JWT_ISSUER`, default `tell`), `jti`, `iat`/`exp`, claim `type=session`
- Registration: email OTP required; direct `/api/auth/register` disabled
- OTP codes: HMAC-SHA256 with `OTP_PEPPER` (falls back to `JWT_SECRET`), timing-safe compare, attempt limit 5, single use, short TTL
- Login errors do not distinguish unknown email vs wrong password
- `REGISTRATION_ENABLED` / `EMAIL_OTP_ENABLED` gates; public `GET /api/auth/config` for UI
- `GET /api/auth/me` for session probe; all other product APIs require a verified cookie or `Authorization: Bearer`

### API gateway (`src/proxy.ts`)

1. Method allowlist (blocks TRACE etc.)
2. Content-Length body size cap (256 KiB)
3. Per-IP rate limits by category (+ per-email identity buckets on auth routes)
4. CSRF Origin/Referer checks for cookie-based mutating requests
5. `Content-Type: application/json` required on POST/PUT/PATCH
6. JWT verification for non-public routes
7. `X-Request-Id` on responses

### Error sanitization

AI and provider failures use `safePublicDetail` so clients never see stacks, SQL, or secret-looking text (`src/lib/security/http-errors.ts`).

### CSRF

Cookie sessions are vulnerable to classic CSRF. Mutating `/api` calls without a Bearer token must present an `Origin` or `Referer` that matches the request host or `APP_URL`. Missing Origin is rejected in production. Bearer-authenticated clients are exempt.

### Secrets

- Never commit `.env`
- `JWT_SECRET` ≥ 32 characters; health marks placeholders / short secrets as degraded (error in production-like env)
- Prefer a dedicated `OTP_PEPPER` so OTP hashes are not solely keyed by the JWT secret
- Rotate SMTP app passwords and provider keys if exposed

### Data access

- Parameterized SQL only
- User-scoped tables filter on session `sub`, not client-supplied user IDs
- Health/config checks report presence booleans, never secret values

## Public endpoints

Only these skip authentication:

- `GET /api/health`, `GET /api/ready`
- `GET /api/auth/me`, `GET /api/auth/config`
- `POST /api/auth/login`, `logout`, `register` (disabled), `otp/request`, `otp/verify`

## Optional (not yet in Tell)

OUTSKILL VDDA also uses short-lived access JWTs + rotatable/revocable refresh tokens in a DB table. Tell keeps a single longer-lived session cookie for simplicity; refresh-token revoke is a reasonable next hardening step for multi-device logout.

## Reporting

See `public/.well-known/security.txt`. Prefer responsible disclosure with reproduction steps and impact; do not include live secrets in tickets.

## Checklist before production

1. Unique `JWT_SECRET` (≥ 32 random bytes / chars) and optional `OTP_PEPPER`
2. SMTP + `APP_URL` set; `TELL_OTP_DEV_ECHO` unset
3. `REGISTRATION_ENABLED` intentional
4. Turso, FRED, and optional AI keys only in the host secret store
5. Confirm `/api/health` shows strong JWT and core data populated
6. Confirm security headers with a browser or `curl -I`
