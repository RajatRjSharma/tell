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
make ingest-manual     # IMF DataMapper cross-country (run on your machine)
make ingest-all        # FRED + IMF (manual) + markets locally
```

`make ingest-manual` pulls **true IMF WEO** when you can (DataMapper is often blocked
from GitHub cloud IPs). Run it whenever you want — daily, weekly, or after WEO updates.
Requires `.env` with Turso credentials (no IMF API key).

Optional: set `FRED_OBSERVATION_START`, `IMF_MIN_YEAR`, or `MARKET_OBSERVATION_START=2023-01-01` in `.env`.

## Daily ingest (GitHub Actions)

Workflow: `.github/workflows/ingest.yml`

- Runs daily at **06:00 UTC** and on **Actions → Daily ingest → Run workflow**
- Upserts **FRED → cross-country (IMF, else World Bank) → Yahoo markets**
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

- `/register` · `/login`
- Cookie JWT (`tell_session`) backed by Turso `users`
- APIs: `/api/auth/register` · `login` · `logout` · `me`

## Disclaimer

Not financial advice. Research tool only.
