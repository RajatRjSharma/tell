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
npm install
npm run db:migrate     # apply Turso schema
npm run dev
```

Never commit `.env`.

## Disclaimer

Not financial advice. Research tool only.
