# Tell

Global activity → market outlook research platform.

## Stack

- Next.js (Vercel)
- Turso
- GitHub Actions (CI + daily ingest)
- Free data + Gemini / Groq

## Setup

```bash
cp .env.example .env   # fill secrets
make setup             # install + migrate + seed
make dev
```

Or with npm:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Never commit `.env`.

## Ingest

```bash
make ingest-fred       # US macro from FRED → Turso readings
make ingest-markets    # Asset OHLC from Yahoo Finance → Turso asset_readings
make ingest-events     # Fed / ECB / BoE RSS → Turso events
make ingest-manual     # IMF DataMapper cross-country (run on your machine)
make ingest-all        # FRED + IMF (manual) + markets + events locally
```

`make ingest-manual` pulls **true IMF WEO** when you can (DataMapper is often blocked
from GitHub cloud IPs). Run it whenever you want — daily, weekly, or after WEO updates.
Requires `.env` with Turso credentials (no IMF API key).

`make ingest-events` pulls free central-bank RSS (no API key). Keyword tags add a light
hawkish/dovish tilt and likely asset relevance for the dashboard + AI context.

`GET /api/events/impact` (and the dashboard **Event impact study** panel) measures median
forward returns at 1d / 1w / 1m after similar Fed/ECB/BoE releases. Optional
`sentiment=hawkish|dovish`. Historical analogues only — not predictions.

Optional: set `FRED_OBSERVATION_START`, `IMF_MIN_YEAR`, or `MARKET_OBSERVATION_START=2023-01-01` in `.env`.

## Features / regimes

```bash
make compute-features   # US macro + market features + regime snapshot from Turso
```

Optional: `FEATURE_AS_OF=2024-06-01` or `FEATURE_SYMBOLS=SPY,TLT,GLD` in the environment.
Pure TypeScript transforms (no ML). Used as inputs for the signal engine.

## Signals

```bash
make compute-signals   # Write bullish/neutral/bearish outlooks to Turso
make compute-forecasts # Score resolved signals into forecast_log (hit rate)
make backfill-signals  # Recompute last N trading days of signals + forecasts
make compute-alerts    # Evaluate watchlist alert rules → in-app inbox
```

Defaults: horizons `1d,1w,1m` (≈ 1 / 5 / 21 trading sessions). Custom day horizons:

```bash
SIGNAL_HORIZONS=1d,1w,1m,10d,60d make compute-signals
```

Hourly horizons are not supported yet (daily bars only). Near-real-time **last price**
overlay uses Finnhub quote when `FINNHUB_API_KEY` is set, else Yahoo — printed by
`compute-signals` for context; scores still use daily features.

`compute-forecasts` compares each stored signal to the realized forward return once
enough bars exist. Neutral is graded with a small band that widens with horizon length.
Daily Actions runs this after `compute:signals` (no AI keys).

`make backfill-signals` walks recent SPY trading days (default `BACKFILL_DAYS=90`),
upserts historical `signals`, then evaluates `forecast_log` so quality hit rates have
real sample size. Optional: `BACKFILL_FROM` / `BACKFILL_TO`, `FORECAST_SYMBOLS`,
`BACKFILL_SKIP_FORECASTS=1`. Do **not** run this every day in CI — use locally or
occasionally after rule changes. FRED ingest also stores ALFRED vintages for key US
series (`CPI`, `UNRATE`, `INDPRO`, `GDP`); live features still read `vintage=current`.

`compute-alerts` checks enabled rules (direction flip, became direction, confidence
below) against the latest signals and writes unread `alert_events` (and emails when
SMTP is configured). First observation after creating a rule is a baseline only (no
false fire).

`make compute-watchlist-briefs` (local Gemini only) emails a personal brief for each
user with a non-empty watchlist when SMTP is set.

## Daily ingest (GitHub Actions)

Workflow: `.github/workflows/ingest.yml`

- Runs daily at **06:00 UTC** and on **Actions → Daily ingest → Run workflow**
- Upserts **FRED → cross-country (IMF, else World Bank) → Yahoo markets → policy RSS**
- If you miss `make ingest-manual`, Actions still fills cross-country via World Bank
- If you *did* run manual IMF, later World Bank runs **do not overwrite** those WEO rows

Repo secrets (Settings → Secrets and variables → Actions):

| Secret | Required for |
|--------|----------------|
| `TURSO_DATABASE_URL` | ingest + e2e |
| `TURSO_AUTH_TOKEN` | ingest + e2e |
| `FRED_API_KEY` | FRED ingest |
| `JWT_SECRET` | e2e only |

Optional repo **variables** are not required; scripts use built-in start defaults (`2015` / `2023-01-01`). Override locally via `.env` if needed.

## Quality

```bash
make lint
make format-check
make typecheck
make test
make test-e2e          # Playwright (needs .env for full auth flows)
make ci                # lint + format + types + unit + build + e2e
make help              # list all make targets
```

First time for Playwright browsers:

```bash
make install-browsers
# or: npx playwright install chromium
```

Then:

```bash
make ci
```

CI runs on every push/PR to `main` via GitHub Actions (unit + e2e).
Daily data refresh is a separate scheduled workflow (see above).
For full auth e2e in CI, add repo secrets: `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.

## Auth

- `/register` (OTP email verify) · `/login`
- Cookie JWT (`tell_session`) backed by Turso `users`
- APIs: `/api/auth/otp/request` · `/api/auth/otp/verify` · `login` · `logout` · `me`
  (legacy `POST /api/auth/register` remains for scripts)
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
  `SMTP_USE_TLS`, plus `OTP_EXPIRE_MINUTES` / `OTP_LENGTH`
- Watchlist (signed-in): `GET/POST/DELETE /api/watchlist` — saved symbols filter the dashboard by default when non-empty
- Alerts (signed-in): `GET/POST /api/alerts`, `PATCH/DELETE /api/alerts/rules/:id`, `POST /api/alerts/read` — rules on watchlist symbols; in-app inbox + email after daily evaluate

## Read APIs

Public JSON endpoints (Turso-backed):

| Route | Purpose |
|-------|---------|
| `GET /api/health` | App + config + DB + data counts (`?deep=1` probes Yahoo/Finnhub) |
| `GET /api/ready` | Same as health (deploy / uptime readiness probe) |
| `GET /api/assets` | Asset universe |
| `GET /api/outlook` | Latest signals (`?symbols=SPY,TLT&horizons=1d,1w&asOf=YYYY-MM-DD`) |
| `GET /api/outlook/SPY` | One asset (`?live=1` adds near-real-time quote) |
| `GET /api/charts/SPY` | Daily OHLC series + signal markers (`?horizon=1d&limit=90`) |
| `GET /api/quality` | Signal hit-rate report (`?symbol=SPY`) |
| `GET /api/events` | Policy events (`?source=Fed&country=US&symbol=SPY&since=YYYY-MM-DD&limit=30`) |
| `GET /api/events/impact` | Historical forward returns after similar events (`?symbol=SPY&source=Fed&sentiment=any`) |
| `GET /api/macro/strip` | US CPI / curve / VIX sparkline strip (`?limit=24`) |
| `GET /api/risk/near-term` | Today / tomorrow risk-on|mixed|risk-off ensemble bias |
| `GET /api/readings?country=US&indicator=CPI` | Macro series (`from`/`to`/`limit`) |

## AI (Gemini + Groq)

Optional research layer on top of Turso signals and macro readings.

| Route | Purpose |
|-------|---------|
| `GET /api/brief?symbol=SPY&horizon=1d` | Gemini brief with prior delta (`&refresh=1` regenerates + upserts) |
| `GET /api/brief/history?symbol=SPY&horizon=1d&limit=7` | Stored brief history from Turso |
| `POST /api/chat` | Groq Q&A grounded in latest evidence (`{ message, history?, symbol?, horizon? }`) |

```bash
make compute-briefs   # Persist Gemini briefs for the asset universe
```

Optional: `BRIEF_SYMBOLS=SPY,TLT`, `BRIEF_HORIZONS=1d,1w`, `BRIEF_DELAY_MS=500`.

Set `GEMINI_API_KEY` and `GROQ_API_KEY` in `.env`. Optional: `GEMINI_MODEL` (default `gemini-3.1-flash-lite`, with fallbacks), `GROQ_MODEL`.
Without keys, endpoints return `503` and the UI shows a soft unavailable state.

Dashboard: evidence panel includes a **Gemini brief** with vs-prior delta; header **Ask Tell** opens Groq chat.

Daily Actions ingest runs data + `compute:signals` only.
Do **not** add `GEMINI_API_KEY` / `GROQ_API_KEY` to GitHub Actions secrets — briefs and live evals are local-only so free credits are not burned in CI.

```bash
make compute-briefs                 # local Gemini brief refresh → Turso
TELL_AI_EVAL=1 make test-eval       # local live AI eval
```

Offline AI evals (mocked, no API keys) still run in `npm test`.

After pulling schema changes:

```bash
make db-migrate
```

## Disclaimer

Not financial advice. Research tool only.

See live product copy on [`/methodology`](https://tell-gamma.vercel.app/methodology) — how regimes, `rules-v1` signals, hit rates, events, and AI grounding work.
