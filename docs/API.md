# API reference

All handlers live under `src/app/api/**/route.ts` and return JSON. Errors use the shape `{ "error": string }`. Success responses default to status 200.

Shared helpers in `src/lib/api/http.ts`:

- `jsonOk(data, init?)` returns the payload with an optional status and headers.
- `jsonError(error, status = 400, extras?)` returns `{ error, ...extras }`.
- `parseLimit(raw, fallback, max)` falls back on missing, non-numeric, or sub-1 values, then floors and caps.
- `parseOptionalDate(raw)` accepts only the shape `YYYY-MM-DD` and does not check calendar validity.

Authenticated endpoints require a verified JWT from the `AUTH_COOKIE_NAME` cookie (default `tell_session`) or an `Authorization: Bearer <token>` header. User identity always comes from the verified token, never from the request body.

## Authentication gate

`src/proxy.ts` verifies the session on every `/api/*` request before the route runs, and also enforces rate limits, CSRF Origin checks, method allowlisting, body size limits, and JSON Content-Type on mutating requests. See [Security](SECURITY.md).

Public (no token):

| Method and path | Why |
| --------------- | --- |
| `GET /api/health`, `GET /api/ready` | Uptime probes |
| `GET /api/auth/me` | Session probe |
| `GET /api/auth/config` | Public registration/OTP flags |
| `POST /api/auth/login` | Sign in |
| `POST /api/auth/logout` | Clear cookie |
| `POST /api/auth/register` | Disabled stub |
| `POST /api/auth/otp/request` | Send OTP |
| `POST /api/auth/otp/verify` | Complete signup |

All other API routes return `401 { "error": "Authentication required" }` with `WWW-Authenticate: Bearer` when the cookie or Bearer JWT is missing or invalid.

## Rate limiting

Every `/api/*` request is rate-limited in `src/proxy.ts` before the route handler runs. Limits are per client IP (from `x-forwarded-for` / `x-real-ip`) per minute.

| Category | Paths | Default / min |
| -------- | ----- | ------------- |
| `health` | `/api/health`, `/api/ready` | 120 |
| `auth` | `/api/auth/*` | 20 |
| `brief` | `/api/brief`, `/api/brief/history` | 20 |
| `chat` | `/api/chat` | 20 |
| `write` | mutating `/api/watchlist`, `/api/alerts*` | 30 |
| `api` | all other API routes | 60 |

Exceeded limit response: `429` with `{ error, retryAfterSec, category }` and a `Retry-After` header.

## Endpoint index

| Method and path | Auth | Purpose |
| --------------- | ---- | ------- |
| `POST /api/auth/register` | No | Disabled; returns `403` pointing to OTP |
| `POST /api/auth/login` | No | Sign in |
| `POST /api/auth/logout` | No | Clear session cookie |
| `GET /api/auth/me` | Cookie | Current user |
| `GET /api/auth/config` | No | `{ registrationEnabled, emailOtpEnabled }` |
| `POST /api/auth/otp/request` | No | Email a verification code |
| `POST /api/auth/otp/verify` | No | Verify code and create account |
| `GET /api/assets` | No | Seeded asset universe |
| `GET /api/readings` | No | Macro series history |
| `GET /api/outlook` | No | Latest signals across symbols |
| `GET /api/outlook/[symbol]` | No | Per-symbol signals and optional live quote |
| `GET /api/charts/[symbol]` | No | Price bars with signal markers |
| `GET /api/quality` | No | Forecast hit rates |
| `GET /api/macro/strip` | No | Macro sparkline series |
| `GET /api/risk/near-term` | No | Today and tomorrow risk bias |
| `GET /api/events` | No | Policy events |
| `GET /api/events/impact` | No | Event study statistics |
| `GET /api/watchlist` | Yes | List saved symbols |
| `POST /api/watchlist` | Yes | Add symbol |
| `DELETE /api/watchlist` | Yes | Remove symbol |
| `GET /api/alerts` | Yes | Rules, inbox, unread count |
| `POST /api/alerts` | Yes | Create rule |
| `PATCH /api/alerts/rules/[id]` | Yes | Enable or disable rule |
| `DELETE /api/alerts/rules/[id]` | Yes | Delete rule |
| `POST /api/alerts/read` | Yes | Mark alerts read |
| `GET /api/brief` | Rate limited | Gemini research brief |
| `GET /api/brief/history` | No | Stored brief history |
| `POST /api/chat` | Rate limited | Grounded research chat |
| `GET /api/health` | No | Health with optional deep probes |
| `GET /api/ready` | No | Readiness, same checks |

## Authentication

### `POST /api/auth/register`

Disabled. Always returns `403`:

```json
{
  "error": "Email verification is required. Request a code with POST /api/auth/otp/request, then complete signup with POST /api/auth/otp/verify.",
  "otpRequest": "/api/auth/otp/request",
  "otpVerify": "/api/auth/otp/verify"
}
```

Use the OTP endpoints below to create accounts.

### `POST /api/auth/login`

Body: `email`, `password`, validated as above.

Success: `{ user: { id, email } }` plus session cookie.

Errors: 400 validation messages, 401 `Invalid email or password` for both unknown email and wrong password, 500 `Login failed`.

### `POST /api/auth/logout`

No body. Clears the cookie and returns `{ ok: true }`.

### `GET /api/auth/me`

Signed in: `{ user: { id, email } }`. Signed out: status 401 with `{ user: null }`, which is intentionally not an error shape.

### `GET /api/auth/config`

Public flags for the login/register UI (no auth):

```json
{ "registrationEnabled": true, "emailOtpEnabled": true }
```

### `POST /api/auth/otp/request`

Body: `email`, optional `purpose` (default and only accepted value `register`).

Code length comes from `OTP_LENGTH` (default 6, clamped 4 to 8) and lifetime from `OTP_EXPIRE_MINUTES` (default 10, clamped 5 to 60).

Success: `{ ok: true, expiresAt, expireMinutes }`, plus `devCode` only when `TELL_OTP_DEV_ECHO=1`.

Errors: 400 `Enter a valid email address`, 400 `Unsupported purpose`, 403 `Registration is currently closed`, 409 `An account with this email already exists`, 429 auth rate limit, 503 `Email verification is disabled on this server`, 503 `Email delivery is not configured on this server`, 500 `Failed to send verification code`.

### `POST /api/auth/otp/verify`

Body: `email`, `password`, `otp` matching `/^\d{4,8}$/`, optional `purpose`.

Success 201: `{ user: { id, email } }`, code consumed, session cookie set.

Errors: 400 `Unsupported purpose`, 400 `Enter a valid email address`, 400 `Password must be at least 8 characters`, 400 `Enter the verification code from your email`, 400 `No verification code found. Request a new one.`, 400 `Too many attempts. Request a new code.` after 5 failures, 400 `Code expired. Request a new one.`, 400 `Invalid verification code.`, 403 `Registration is currently closed`, 409 `An account with this email already exists`, 429 auth rate limit, 503 `Email verification is disabled on this server`, 500 `Verification failed`.

## Market data and outlook

### `GET /api/assets`

No parameters. Returns `{ assets: [{ symbol, name, assetClass, countryCode, currency, sourceSymbol }], count }`, where `countryCode`, `currency`, and `sourceSymbol` may be null. Error: 500 `Failed to load assets`.

### `GET /api/readings`

| Parameter | Rules |
| --------- | ----- |
| `country` | Required, uppercased, `/^[A-Z]{2}$/` |
| `indicator` | Required, uppercased, `/^[A-Z0-9_]{2,32}$/` |
| `from`, `to` | Optional `YYYY-MM-DD` |
| `limit` | Default 120, maximum 2000 |

Returns `{ countryCode, indicatorId, count, readings: [{ countryCode, indicatorId, observedFor, value, source }] }`, newest first.

Errors: 400 `Query country=XX (ISO-2) is required`, 400 `Query indicator=ID is required`, 400 `from must be YYYY-MM-DD`, 400 `to must be YYYY-MM-DD`, 500 `Failed to load readings`.

### `GET /api/outlook`

Parameters: optional `asOf` (`YYYY-MM-DD`), optional `symbols` (comma separated, uppercased), optional `horizons` (comma separated, lowercased).

Returns `{ asOf, modelVersion, count, bySymbol, signals, disclaimer }`, where each signal is:

```json
{
  "symbol": "SPY",
  "horizon": "1d",
  "asOfDate": "2026-08-14",
  "score": 0.4212,
  "direction": "bullish",
  "confidence": 0.7053,
  "drivers": [{ "code": "regime_expansion", "detail": "...", "weight": 0.4 }],
  "regime": "expansion",
  "modelVersion": "rules-v1"
}
```

`confidence` and `regime` may be null. Errors: 400 `asOf must be YYYY-MM-DD`, 500 `Failed to load outlook`.

### `GET /api/outlook/[symbol]`

Path `symbol` is decoded, uppercased, and must match `/^[A-Z0-9.=_-]{1,20}$/`. Query: optional `asOf`, and `live=1` or `live=true` to attempt a quote.

Returns `{ asset, modelVersion, asOf, signals, quote, disclaimer }`. The quote is null unless a live fetch succeeds:

```json
{
  "symbol": "SPY",
  "price": 553.21,
  "change": 1.94,
  "changePercent": 0.35,
  "previousClose": 551.27,
  "asOfUnix": 1755180000,
  "source": "finnhub"
}
```

Source is `finnhub` or `yahoo`; every field except `symbol`, `price`, and `source` may be null. A quote failure is deliberately swallowed.

Errors: 400 `Invalid symbol`, 400 `asOf must be YYYY-MM-DD`, 404 `Unknown symbol: X`, 500 `Failed to load outlook`.

### `GET /api/charts/[symbol]`

Parameters: `from`, `to` optional dates; `horizon` matching `1d`, `1w`, `1m`, or `Nd`; `limit` default 90, maximum 400.

Returns `{ symbol, from, to, bars, signals, changePct, count, disclaimer }`, where bars carry `date, open, high, low, close, volume` and signal markers carry `date, horizon, direction, score, confidence`. Optional fields may be null.

Errors: 400 `Invalid symbol`, 400 `from must be YYYY-MM-DD`, 400 `to must be YYYY-MM-DD`, 400 `horizon must be 1d, 1w, 1m, or Nd`, 500 `Failed to load chart`.

### `GET /api/quality`

Optional `symbol`, uppercased. Recent rows are fixed at 12 and aggregates read up to 2000 forecasts.

Returns `{ modelVersion, overall, byHorizon, bySymbol, recent, disclaimer }`. Each stats block is `{ n, hits, hitRate, avgReturnWhenBullish, avgReturnWhenBearish }`; recent rows are `{ symbol, horizon, asOfDate, direction, score, confidence, actualReturn, correct, modelVersion, evaluatedAt }`.

Error: 500 `Failed to load signal quality`.

### `GET /api/macro/strip`

`limit` default 24, maximum 120; the helper also enforces a minimum of 6, so smaller values still return 6 points.

Returns `{ strip: { countryCode, series: [{ id, label, unit, latest, asOf, change, rangeChange, points: [{ date, value }] }] } }` with `unit` in `index`, `percent`, `level`.

Error: 500 `Failed to load macro strip`.

### `GET /api/risk/near-term`

No parameters. Returns:

```json
{
  "asOf": "2026-08-14",
  "today": { "label": "risk-on", "score": 0.21, "bullish": 7, "neutral": 4, "bearish": 2, "note": "..." },
  "tomorrow": { "label": "mixed", "score": 0.137, "note": "..." },
  "sampleSize": 13
}
```

Labels are `risk-on`, `mixed`, or `risk-off`; `asOf` may be null. Error: 500 `Failed to compute near-term bias`.

## Events

### `GET /api/events`

Parameters: `limit` default 30, maximum 100; optional `country` (uppercased), `source`, `symbol` (uppercased), `since` (`YYYY-MM-DD`).

Returns `{ count, events: [{ id, date, countryCode, type, title, summary, url, sentiment, assetsImpact, source, createdAt }] }`, where `assetsImpact` is a string array.

Errors: 400 `since must be YYYY-MM-DD`, 500 `Failed to load events`.

### `GET /api/events/impact`

Parameters: optional `source` (defaults to the symbol's mapped source, otherwise `Fed`), optional `symbol`, `sentiment` in `any`, `hawkish`, `dovish` (default `any`), and `horizons` defaulting to `1d,1w,1m`. Preset horizons are `1d`, `1w`, `2w`, `1m`, `3m`, `6m`, `1y`; custom `Nd` must be 1 to 504.

With matches, returns `{ report: { source, sentimentFilter, eventCount, oldestEvent, newestEvent, horizons, assets, rows, sampleEvents, disclaimer } }`, where each row is `{ symbol, horizon, stats: { n, mean, median, hitRateUp } }`.

With no matches, still 200: `{ report: null, message: "No matching policy events yet — run make ingest-events" }`.

Errors: 400 `sentiment must be any, hawkish, or dovish`, 400 `Empty horizon token`, 400 `Horizon out of range: X`, 400 `Unknown horizon "X". Use presets (1d,1w,1m,2w,3m,6m,1y) or Nd (e.g. 10d).`, 500 `Failed to compute event impact`.

## Watchlist

### `GET /api/watchlist`

Returns `{ symbols: string[] }`. Errors: 401 `Sign in to view your watchlist`, 500 `Failed to load watchlist`.

### `POST /api/watchlist`

Body `symbol`, uppercased and matched against `/^[A-Z0-9.=_-]{1,20}$/`, and it must exist in `assets`. Adding twice is idempotent.

Success 201: `{ symbols }`. Errors: 400 `Invalid symbol`, 401 `Sign in to save symbols`, 404 `Unknown symbol: X`, 500 `Failed to add symbol`.

### `DELETE /api/watchlist`

Takes `symbol` from the query string, falling back to the JSON body. Asset existence is not checked and removing an absent symbol still succeeds.

Success: `{ symbols }`. Errors: 400 `Invalid symbol`, 401 `Sign in to update your watchlist`, 500 `Failed to remove symbol`.

## Alerts

### `GET /api/alerts`

`limit` default 30, maximum 100. Returns `{ rules, events, unreadCount }`.

Rule fields: `id, userId, symbol, horizon, ruleType, ruleValue, enabled, lastTriggeredAt, lastSeenDirection, lastSeenConfidence, lastSeenAsOf, createdAt`.

Event fields: `id, ruleId, userId, symbol, horizon, ruleType, title, body, signalDirection, signalConfidence, asOfDate, readAt, createdAt`.

Errors: 401 `Sign in to view alerts`, 500 `Failed to load alerts`.

### `POST /api/alerts`

| Field | Rules |
| ----- | ----- |
| `symbol` | Valid symbol, must exist and already be on the user's watchlist |
| `horizon` | `1d`, `1w`, or `1m`; default `1d` |
| `ruleType` | `direction_change`, `became_direction`, or `confidence_below` |
| `ruleValue` | Ignored for `direction_change`; `bullish`, `neutral`, or `bearish` for `became_direction`; a finite number strictly between 0 and 1 for `confidence_below` |

Success 201: `{ rule }`. Errors: 400 `Invalid symbol`, 400 `horizon must be 1d, 1w, or 1m`, 400 `ruleType must be direction_change, became_direction, or confidence_below`, 400 `ruleValue must be one of bullish, neutral, bearish`, 400 `ruleValue must be a confidence between 0 and 1`, 400 `Add the symbol to your watchlist before creating an alert`, 401 `Sign in to create alerts`, 404 `Unknown symbol: X`, 500 `Failed to create alert`.

### `PATCH /api/alerts/rules/[id]`

Path `id` must be an integer of at least 1; body requires a real boolean `enabled`.

Success: `{ rule }`. Errors: 400 `Invalid rule id`, 400 `enabled boolean is required`, 401 `Sign in to update alerts`, 404 `Alert rule not found`, 500 `Failed to update alert`.

### `DELETE /api/alerts/rules/[id]`

Success: `{ ok: true }`. Errors: 400 `Invalid rule id`, 401 `Sign in to delete alerts`, 404 `Alert rule not found`, 500 `Failed to delete alert`.

### `POST /api/alerts/read`

Body accepts `all: true` or `eventIds: number[]`; a truthy `all` ignores `eventIds`, and only positive integer IDs survive downstream filtering.

Success: `{ updated }`. Errors: 400 `Provide all=true or eventIds`, 401 `Sign in to update alerts`, 500 `Failed to mark alerts read`.

## AI

AI endpoints use the shared `/api` rate limiter (`brief` / `chat` categories).

### `GET /api/brief`

Parameters: optional `symbol`, `horizon` matching `1d`, `1w`, `1m`, or `Nd` (default `1d`), and `refresh=1` to bypass caches.

Returns `{ title, summary, bullets, risks, model, provider, asOf, symbol, horizon, cached, source?, disclaimer, previous, delta }`. Provider is `gemini` and `source` is `memory`, `database`, or `live`. When history exists, `delta` reports `{ previousAsOf, titleChanged, summaryChanged, addedBullets, removedBullets }`.

Errors: 400 `horizon must be 1d, 1w, 1m, or Nd`; 429 `{ error: "Too many brief requests", retryAfterSec }`; 503 `GEMINI_API_KEY is not configured`; provider 4xx passed through as `Gemini request failed (status): body`; provider 5xx mapped to 502; 502 `Gemini returned an empty brief`; 502 `Gemini models unavailable`; 500 `Failed to generate brief`.

### `GET /api/brief/history`

Parameters: optional `symbol` (empty maps to the `_MARKET` sentinel and returns null), `horizon` as above, `limit` default 7 and maximum 30.

Returns `{ symbol, horizon, count, briefs, disclaimer }`. Errors: 400 `horizon must be 1d, 1w, 1m, or Nd`, 500 `Failed to load brief history`.

### `POST /api/chat`

Body: `message` (required, trimmed, truncated to 2000 characters), optional `history` (only `user` and `assistant` roles, last 6 entries, each truncated to 2000 characters), optional `symbol`, optional `horizon` (default `1d`).

Returns `{ answer, model, provider, citations, disclaimer }` with provider `groq`. The context includes latest signals, macro readings, recent events, and full-text retrieval hits for the question.

Errors: 400 `message is required`, 400 `horizon must be 1d, 1w, 1m, or Nd`, 429 `{ error: "Too many chat requests", retryAfterSec }`, 503 `GROQ_API_KEY is not configured`, provider 4xx passed through as `Groq request failed (status): body`, provider 5xx mapped to 502, 502 `Groq returned an empty answer`, 500 `Failed to answer question`.

## Health and readiness

`GET /api/health` and `GET /api/ready` share checks and response shape. `deep=1` or `deep=true` adds outbound provider probes. Status is 200 for `ok` and `degraded`, and 503 for `error`.

```json
{
  "ok": true,
  "status": "ok",
  "service": "tell",
  "version": "0.1.0",
  "time": "2026-08-15T12:34:56.000Z",
  "checks": { }
}
```

| Check | Contents |
| ----- | -------- |
| `app` | Always ok, with `node` and `env` |
| `config` | Booleans for required `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET` and optional `FRED_API_KEY`, `FINNHUB_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`; missing required keys produce `Missing required env: ...` and status error |
| `database` | `Turso reachable` with `latencyMs`, or `Database client unavailable (missing env?)`, or the query error |
| `data` | Counts for `signals`, `readings`, `assetReadings`, `events` plus `latestSignalAsOf` and `modelVersion`; skipped when the database is down |
| `yahoo` | Deep only; failures are degraded, not error |
| `finnhub` | Deep only; skipped without an API key |

Data messages include `Core tables populated`, `Missing macro or market history — run ingest`, and `No signals yet — run make compute-signals`.

Secret values are never returned, only presence booleans. The only difference between the two routes is version sourcing: `/api/health` uses the `package.json` version, while `/api/ready` reads `npm_package_version` and falls back to `0.1.0`.
