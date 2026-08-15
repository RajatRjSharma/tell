# Auth and email

Tell uses email-verified registration, stateless signed sessions, and SMTP for both verification codes and research notifications.

## Registration with a one-time code

New accounts require email verification. Direct `POST /api/auth/register` is disabled.

Gates (from env):

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `REGISTRATION_ENABLED` | `true` | `false` closes new sign-ups; login still works |
| `EMAIL_OTP_ENABLED` | `true` | `false` refuses OTP when the host blocks SMTP |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `20` | Per-IP limit across login / OTP request / OTP verify |

```text
POST /api/auth/otp/request   email
   -> reject if registration closed, OTP disabled, or account exists
   -> generate code, store SHA-256 hash, email the code
POST /api/auth/otp/verify    email + code + password
   -> validate code, create user, set session cookie
```

Code lifecycle in `src/lib/auth/otp.ts`:

| Behavior | Detail |
| -------- | ------ |
| Length | `OTP_LENGTH`, default 6, clamped between 4 and 8 |
| Generation | `crypto.randomInt` zero-padded to the configured length |
| Storage | HMAC-SHA256 in `auth_otps.code_hash` using `OTP_PEPPER` (or `JWT_SECRET`); plaintext is never stored |
| Lifetime | `OTP_EXPIRE_MINUTES`, default 10, clamped between 5 and 60 |
| Replacement | Requesting a new code deletes previous rows for that email and purpose |
| Attempt limit | 5 failures, after which the code is rejected until a new one is requested |
| Consumption | A successful verification deletes the row, so codes are single use |
| Purpose | Only `register` is accepted today; the column exists for future flows such as password reset |

Failure messages are deliberately specific about the code state (`expired`, `invalid`, `too many attempts`) but never reveal whether the code was close to correct.

Guardrails worth noting:

- OTP requests reject addresses that already have accounts, so the flow cannot be used to probe existing users through the verify step.
- Without SMTP configured, requests return 503 unless `TELL_OTP_DEV_ECHO=1`.
- `POST /api/auth/register` is disabled (`403`); every new account must complete email OTP verification.
- Set `REGISTRATION_ENABLED=false` to freeze sign-ups without breaking existing logins.
- Set `EMAIL_OTP_ENABLED=false` on hosts that block outbound SMTP (OTP endpoints return 503).

## Sessions

| Property | Value |
| -------- | ----- |
| Cookie name | `AUTH_COOKIE_NAME` (default `tell_session`) |
| Contents | HS256 JWT signed with `JWT_SECRET`, subject is the user ID, plus `email` |
| Lifetime | `JWT_EXPIRE_DAYS` (default 14) for both token expiry and cookie `maxAge` |
| Flags | `httpOnly`, `sameSite` from `AUTH_COOKIE_SAMESITE` (default `lax`), `path=/`, `secure` from `AUTH_COOKIE_SECURE` or production / `SameSite=none` |
| Verification | `jwtVerify`; any failure returns null instead of throwing |
| API access | Every `/api/*` route (except login/OTP/health) requires this cookie or `Authorization: Bearer <jwt>` |

Every authenticated route resolves the user from the verified token subject, so a request cannot act on another account by passing a different ID. Passwords are hashed with bcrypt and require at least 8 characters; login returns one message for both unknown email and wrong password.

`JWT_SECRET` should be a long random string, ideally 32 characters or more. Rotating it invalidates all existing sessions.

## Development shortcut

Setting `TELL_OTP_DEV_ECHO=1` makes `POST /api/auth/otp/request` return the code as `devCode`, and the registration form fills it automatically. This keeps local development and Playwright runs working without SMTP; `playwright.config.ts` sets it for the test server. Never enable it in production, because it hands the verification code to any caller.

## SMTP configuration

Configuration is read at send time in `src/lib/email/mailer.ts`:

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `SMTP_HOST` | none | Required |
| `SMTP_PORT` | 587 | Non-numeric values fall back to 587 |
| `SMTP_USER` | none | Required, used for auth |
| `SMTP_PASSWORD` | none | Required, app password for Gmail |
| `SMTP_FROM` | `SMTP_USER` | Accepts `Name <address>` |
| `SMTP_USE_TLS` | true | Only the literal `false` disables STARTTLS |
| `EMAIL_DELIVERY_ENABLED` | true | Set false to stop all outbound email |
| `APP_URL` | `https://tell-gamma.vercel.app` | Link target inside templates |

Transport rules: `secure` is enabled on port 465; other ports require STARTTLS. Production-like environments cannot disable TLS. Connections use bounded connect, greeting, and socket timeouts, require TLS 1.2 or newer, and verify certificates. Recipient/subject validation blocks header injection and oversized message bodies. If configuration is missing or delivery is switched off, `sendMail` returns a skipped result instead of throwing, so alert evaluation still records inbox entries.

`TEST_MODE=1` is a hard delivery block. Playwright does not load `.env`: it creates a disposable local libSQL database, blanks all provider/SMTP keys, and obtains OTPs through the local-only echo path. CI therefore needs no production SMTP, Turso, or AI secrets.

Gmail specifics: use an app password from an account with two-factor authentication, host `smtp.gmail.com`, port 587. Treat the app password as a secret; if it is ever committed or pasted into a chat, revoke it in the Google account and issue a new one.

## Templates

`src/lib/email/templates.ts` builds three plain-HTML templates with matching text alternatives, each returning `{ subject, html, text }`:

| Template | Trigger | Contents |
| -------- | ------- | -------- |
| `otpEmailTemplate` | Registration code request | Large monospace code, expiry in minutes, ignore-if-not-you note |
| `alertEmailTemplate` | Alert rule fires during `compute:alerts` | Rule copy, symbol, horizon, as-of date, dashboard link |
| `watchlistBriefEmailTemplate` | `compute:watchlist-briefs` | Per-symbol title, summary, bullets, risks, dashboard link |

Template characteristics:

- Inline styles and presentation tables for broad email-client compatibility.
- Every message ships an HTML body and a text body.
- Interpolated values are escaped before insertion.
- OTP codes stay out of subjects and preheaders to reduce lock-screen and mail-log exposure.
- Link schemes are restricted to HTTP(S).
- A research-aid disclaimer appears on notification emails.
- Unit tests in `src/lib/email/templates.test.ts` assert subject lines and body contents.

## Delivery paths

| Path | Where | Behavior on failure |
| ---- | ----- | ------------------- |
| Verification code | `POST /api/auth/otp/request` | 503 when SMTP is unconfigured, 500 on send failure |
| Alert email | `src/lib/alerts/evaluate.ts` during `compute:alerts` | Warning logged; the inbox row is still written and the run continues |
| Watchlist brief | `scripts/compute-watchlist-briefs.ts` | Counted as skipped; other users still processed |

Alert email is tied to a rule the user created, and the script reports `considered`, `triggered`, `baselined`, `skipped`, and `emailed` so delivery is observable. `alert_events` is unique on `(rule_id, as_of_date)`, which prevents duplicate mail for the same day even if the job runs twice. Bulk watchlist brief delivery is off by default and requires `WATCHLIST_BRIEF_EMAIL=1`; brief generation itself still runs.

## Verifying a setup

```bash
# 1. Local OTP flow without SMTP
TELL_OTP_DEV_ECHO=1 npm run dev

# 2. Real delivery: request a code from the running app
curl -s -X POST http://localhost:3000/api/auth/otp/request \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com"}'

# 3. Alert email path
npm run compute:alerts     # look for emailed=N in the output
```

If step 2 returns 503, SMTP is incomplete. If it returns 500, the credentials or host and port are wrong. `GET /api/health` reports required configuration presence, though it does not probe SMTP.

## Checklist for production

1. Set `JWT_SECRET` to a fresh random value of at least 32 characters.
2. Set all five SMTP variables plus `APP_URL` in the hosting provider.
3. Leave `TELL_OTP_DEV_ECHO` unset.
4. Leave `TEST_MODE` unset and set `EMAIL_DELIVERY_ENABLED=true`.
5. Confirm SPF, DKIM, and DMARC for the sender domain (or a valid Gmail app password).
6. If credentials ever leak, revoke first and redeploy with replacements.
