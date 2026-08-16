# Tell documentation

![Tell platform architecture](tell-architecture.png)

Tell turns global macro, market, and central-bank data into explainable multi-asset outlooks for 1d, 1w, and 1m horizons. Turso is the system of record, scheduled TypeScript jobs handle ingestion and scoring, and the Next.js application serves the dashboard, APIs, and notifications.

## Contents

| Document | Covers |
| -------- | ------ |
| [Architecture](ARCHITECTURE.md) | Layers, data flow, repository layout, runtime dependencies |
| [Data model](DATA-MODEL.md) | Every Turso table, column, index, and write path |
| [Signal methodology](SIGNALS.md) | Features, regime rules, scoring, forecasts, risk bias, event studies |
| [API reference](API.md) | Every endpoint with parameters, responses, and error codes |
| [Auth and email](AUTH-AND-EMAIL.md) | Username/email OTP registration, sessions, SMTP delivery, templates |
| [Security](SECURITY.md) | Headers, CSRF, auth, secrets, disclosure |
| [Operations](OPERATIONS.md) | Environment, commands, workflows, runbooks, troubleshooting |

## Quick orientation

- Live application: `https://tell-gamma.vercel.app`
- Repository: `https://github.com/RajatRjSharma/tell`
- Model version stamped on every signal: `rules-v1`
- Default horizons: `1d`, `1w`, `1m`
- Daily pipeline: four times UTC (00:00 / 06:00 / 12:00 / 18:00) via GitHub Actions

## Start here

```bash
cp .env.example .env
make setup
make dev
```

Then populate data and compute a first outlook:

```bash
make ingest-all
make compute-signals
make compute-forecasts
```

Tell is a research aid. Its signals, hit rates, and summaries are not financial advice or guaranteed forecasts.
