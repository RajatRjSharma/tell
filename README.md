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

## Quality

```bash
make lint
make format-check
make typecheck
make test
make ci                # lint + format + types + test + build
make help              # list all make targets
```

CI runs on every push/PR to `main` via GitHub Actions.

## Auth

- `/register` · `/login`
- Cookie JWT (`tell_session`) backed by Turso `users`
- APIs: `/api/auth/register` · `login` · `logout` · `me`

## Disclaimer

Not financial advice. Research tool only.
