# Tell

Global activity → market outlook research platform.

## Stack

- Next.js (Vercel)
- Turso
- GitHub Actions (later)
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
```

Optional: set `FRED_OBSERVATION_START=2018-01-01` in `.env`.

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
For full auth e2e in CI, add repo secrets: `JWT_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.

## Auth

- `/register` · `/login`
- Cookie JWT (`tell_session`) backed by Turso `users`
- APIs: `/api/auth/register` · `login` · `logout` · `me`

## Disclaimer

Not financial advice. Research tool only.
