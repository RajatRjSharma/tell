# Operations

Runbook for setting up, running, and maintaining Tell.

## Prerequisites

| Requirement | Notes |
| ----------- | ----- |
| Node 22 | Matches CI and Vercel |
| npm | Lockfile is `package-lock.json`, CI uses `npm ci` |
| Turso database | Free tier is sufficient |
| FRED API key | Free, needed for US macro ingest |
| SMTP credentials | Needed for OTP registration and email alerts |
| Gemini and Groq keys | Optional, only for briefs and chat |
| Finnhub key | Optional, live quotes fall back to Yahoo |

## First run

```bash
git clone https://github.com/RajatRjSharma/tell.git
cd tell
cp .env.example .env      # fill in Turso, FRED, JWT_SECRET, SMTP
make setup                # install deps, Playwright Chromium, migrate, seed
make ingest-all           # FRED, IMF, markets, events
make compute-signals
make compute-forecasts
make dev                  # http://localhost:3000
```

For meaningful hit rates, add history before trusting the quality panel:

```bash
BACKFILL_DAYS=180 make backfill-signals
```

## Environment variables

Required:

| Variable | Purpose |
| -------- | ------- |
| `TURSO_DATABASE_URL` | libSQL endpoint |
| `TURSO_AUTH_TOKEN` | Turso token |
| `JWT_SECRET` | Session signing key, 32 or more characters |

Application / auth:

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `APP_ENV` | `NODE_ENV` / `local` | Environment label |
| `APP_URL` | production URL | Links inside emails |
| `JWT_EXPIRE_DAYS` | 14 | Session lifetime |
| `AUTH_COOKIE_NAME` | `tell_session` | Session cookie name |
| `AUTH_COOKIE_SAMESITE` | `lax` | `lax`, `strict`, or `none` |
| `AUTH_COOKIE_SECURE` | auto | Force cookie Secure on/off |
| `AUTH_RATE_LIMIT_PER_MINUTE` | 20 | Auth endpoints |
| `API_RATE_LIMIT_PER_MINUTE` | 60 | Default read APIs |
| `WRITE_RATE_LIMIT_PER_MINUTE` | 30 | Watchlist / alert mutations |
| `HEALTH_RATE_LIMIT_PER_MINUTE` | 120 | `/api/health`, `/api/ready` |
| `BRIEF_RATE_LIMIT_PER_MINUTE` | 20 | Brief endpoints |
| `CHAT_RATE_LIMIT_PER_MINUTE` | 20 | Chat endpoint |
| `REGISTRATION_ENABLED` | true | Close new sign-ups when false |
| `EMAIL_OTP_ENABLED` | true | Disable OTP when SMTP is blocked |

Data providers:

| Variable | Purpose |
| -------- | ------- |
| `FRED_API_KEY` | US macro ingest |
| `FINNHUB_API_KEY` | Live quotes, optional |
| `LIVE_MARKET_QUOTES` | Finnhub/Yahoo fetches (default true; set false in e2e) |

AI, local use only:

| Variable | Purpose |
| -------- | ------- |
| `GEMINI_API_KEY` | Research briefs |
| `GROQ_API_KEY` | Research chat |
| `GEMINI_MODEL` | Defaults to `gemini-3.1-flash-lite` |

Email:

| Variable | Purpose |
| -------- | ------- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_USE_TLS` | Delivery transport |
| `EMAIL_DELIVERY_ENABLED` | Set false to stop all outbound email (default: on) |
| `OTP_EXPIRE_MINUTES`, `OTP_LENGTH` | Verification code policy |
| `APP_URL` | Link target inside emails |

Job tuning, all optional:

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `SIGNAL_HORIZONS` | `1d,1w,1m` | Horizons to score |
| `SIGNAL_AS_OF` | latest market date | Scoring date override |
| `FEATURE_SYMBOLS` | `SPY,TLT,GLD,EURUSD` | Feature snapshot symbols |
| `LIVE_QUOTE_SYMBOLS` | `SPY,GLD,TLT` | Quote context in logs |
| `FORECAST_SYMBOLS` | all | Restrict evaluation |
| `BACKFILL_DAYS` | 90 | Trading days to rebuild, capped at 2000 |
| `BACKFILL_FROM`, `BACKFILL_TO` | unset | Explicit range, overrides day count |
| `BACKFILL_SKIP_FORECASTS` | unset | `1` skips grading |
| `BRIEF_HORIZONS` | `1d,1w,1m` | Brief horizons |
| `BRIEF_SYMBOLS` | all seeded assets | Brief universe |
| `BRIEF_DELAY_MS` | 400 | Pause between brief calls |
| `WATCHLIST_BRIEF_EMAIL` | disabled | `1` explicitly enables bulk watchlist email |
| `FRED_USE_ALFRED` | true | `false` skips vintage fetching |
| `FRED_ALFRED_REALTIME_START` | `2018-01-01` | Earliest vintage to pull |
| `CROSS_COUNTRY_PROVIDER` | auto | `imf` forces IMF DataMapper |
| `TELL_OTP_DEV_ECHO` | unset | `1` echoes OTP codes, local only |
| `TELL_ALLOW_AI_IN_CI` | unset | `1` permits AI scripts under CI |
| `TELL_AI_EVAL` | unset | `1` enables the live model eval |

Where each value belongs:

| Target | Variables |
| ------ | --------- |
| Local `.env` | Everything |
| Vercel | Turso, `JWT_SECRET`, `FINNHUB_API_KEY`, AI keys, SMTP, OTP policy, `APP_URL` |
| GitHub Actions secrets | Turso, `FRED_API_KEY`, and SMTP only if the scheduled job should send alert email |

Never commit `.env`. If a credential is exposed, revoke it at the provider before replacing it.

## Command reference

| Make target | npm script | Purpose |
| ----------- | ---------- | ------- |
| `make setup` | – | Install, browsers, migrate, seed |
| `make dev` | `npm run dev` | Dev server |
| `make build` | `npm run build` | Production build |
| `make db-migrate` | `npm run db:migrate` | Apply `db/schema.sql`, idempotent |
| `make db-seed` | `npm run db:seed` | Countries, indicators, assets |
| `make ingest-fred` | `npm run ingest:fred` | US macro, current plus ALFRED vintages |
| `make ingest-imf` | `npm run ingest:imf` | Cross-country macro with World Bank fallback |
| `make ingest-manual` | – | Force IMF DataMapper locally |
| `make ingest-markets` | `npm run ingest:markets` | Daily bars from Yahoo |
| `make ingest-events` | `npm run ingest:events` | Fed, ECB, BoE RSS |
| `make ingest-all` | – | All four ingest jobs |
| `make compute-features` | `npm run compute:features` | Print feature and regime snapshot |
| `make compute-signals` | `npm run compute:signals` | Score outlooks |
| `make compute-forecasts` | `npm run compute:forecasts` | Grade resolved signals |
| `make backfill-signals` | `npm run backfill:signals` | Rebuild history and grade it |
| `make compute-alerts` | `npm run compute:alerts` | Evaluate rules, send email |
| `make compute-briefs` | `npm run compute:briefs` | Persist Gemini briefs |
| `make compute-watchlist-briefs` | `npm run compute:watchlist-briefs` | Watchlist brief plus email |
| `make lint` / `make format` / `make typecheck` | matching scripts | Static checks |
| `make test` | `npm run test` | Vitest unit suite |
| `make test-e2e` | `npm run test:e2e` | Playwright suite |
| `make test-eval` | `npm run test:eval` | Live model eval, needs `TELL_AI_EVAL=1` |
| `make ci` | `npm run ci` | Lint, format, types, unit, build, e2e |

`make help` prints the same list from target comments.

Playwright tests are isolated from real infrastructure: they create
`.tmp/playwright.db`, blank SMTP/provider keys, set
`EMAIL_DELIVERY_ENABLED=false` and `LIVE_MARKET_QUOTES=false`, raise rate-limit
ceilings (limits still enforced), and reuse one signed-in `storageState` for
read-only product UI specs. Mutating flows (watchlist/alerts) register their
own users. Do not add production secrets to the CI e2e job.

Local `make ci` builds once, then sets `PLAYWRIGHT_SKIP_BUILD=1` so Playwright
reuses `.next` instead of rebuilding. Use `PLAYWRIGHT_WORKERS=2` (default) for
parallel browser workers; set `PLAYWRIGHT_WORKERS=1` if you need serial runs.
`APP_ENV=test` also uses cheaper bcrypt so auth-heavy specs finish faster.

## Scheduled pipeline

`.github/workflows/ingest.yml` runs **twice daily** at **06:00 UTC** and **21:30 UTC**, and on manual dispatch, with `concurrency: daily-ingest` so runs never overlap, a 30 minute timeout, Node 22, and `npm ci`:

1. `db:migrate`
2. `ingest:fred` with `FRED_API_KEY`
3. `ingest:imf` (World Bank fallback on Actions; local `make ingest-manual` for true IMF)
4. `ingest:markets`
5. `ingest:events`
6. `compute:signals`
7. `compute:forecasts`
8. `compute:alerts`

Frequency is capped at two runs/day: daily bars and FRED prints barely change more often, and Yahoo/World Bank are the fragile free endpoints.

Still local-only: `make ingest-manual`, `make compute-features`, `make backfill-signals`, `make compute-briefs`, and `make compute-watchlist-briefs`. Brief/chat stay out of the schedule because they need paid keys.

`.github/workflows/ci.yml` covers lint, format check, typecheck, unit tests, build, and Playwright on pull requests and pushes.

## Monitoring

```bash
curl -s https://tell-gamma.vercel.app/api/health | jq
curl -s 'https://tell-gamma.vercel.app/api/health?deep=1' | jq
```

Read the response as follows:

| Signal | Meaning |
| ------ | ------- |
| `status: ok` | Config present, Turso reachable, core tables populated |
| `status: degraded` | Service is usable but a probe or data check is unhappy |
| `status: error`, HTTP 503 | Required env missing or the database is unreachable |
| `checks.data.latestSignalAsOf` | Freshness of the last scoring run |
| `checks.data.counts` | Whether ingest actually wrote rows |

Deep mode adds Yahoo and Finnhub reachability; those failures are degraded, not fatal. Use `/api/ready` for uptime probes.

## Daily health review

1. Confirm the ingest workflow succeeded.
2. Check `latestSignalAsOf` is the most recent trading day.
3. Open the dashboard and confirm the macro strip and risk bias render.
4. Skim `/api/quality` for hit-rate drift.
5. Check `emailed=N` in the alert job output if email is expected.

## Troubleshooting

| Symptom | Likely cause | Action |
| ------- | ------------ | ------ |
| `Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN` | `.env` not loaded | Copy `.env.example`, fill values, rerun |
| Dashboard shows no signals | No compute run | `make compute-signals` after ingest |
| Hit rates empty | No graded history | `BACKFILL_DAYS=180 make backfill-signals` |
| `No signals yet — run make compute-signals` in health | Same as above | Run compute |
| `Missing macro or market history — run ingest` | Ingest never ran | `make ingest-all` |
| FRED ingest returns nothing | Missing or invalid key | Set `FRED_API_KEY`; the script paces requests for the free tier |
| Cross-country data looks stale in Actions | IMF blocked from cloud IPs | Rely on the World Bank fallback, run `make ingest-manual` locally |
| Event impact says no matching events | Events not ingested | `make ingest-events` |
| Brief or chat returns 503 | AI key missing | Set `GEMINI_API_KEY` or `GROQ_API_KEY` locally |
| Brief or chat returns 429 | Rate limit of 20 requests per minute per client | Wait for `retryAfterSec` |
| Brief or chat returns 502 | Upstream provider error or empty completion | Retry, then check provider status |
| OTP request returns 503 | SMTP incomplete | Fill SMTP variables, or use `TELL_OTP_DEV_ECHO=1` locally |
| OTP request returns 500 | Bad credentials, host, or port | Verify app password and port 587 |
| Alerts fire but no email | SMTP unconfigured or send failed | Check `emailed=N` and the warning log |
| Alert never fires | Rule needs a baseline first | The first evaluation records `baselined`; changes fire afterward |
| Playwright registration fails | Dev echo disabled | Ensure the test server sets `TELL_OTP_DEV_ECHO=1` |
| Retrieval hits missing in chat | `research_fts` absent | Rerun `make db-migrate`, then reingest events or regenerate briefs |
| Live quote missing | Finnhub key absent or provider down | Expected; Yahoo fallback or `quote: null` |

## Maintenance

| Cadence | Task |
| ------- | ---- |
| Daily | Check the ingest run and signal freshness |
| Weekly | Review hit rates and regime labels for plausibility |
| Monthly | `npm outdated`, apply patch updates, run `make ci` |
| Quarterly | Rotate `JWT_SECRET`, SMTP password, and provider keys |
| As needed | Re-run `make db-migrate` after pulling schema changes |

## Adding to the system

**New asset**: add an entry to `assets` in `src/data/seed.ts` with a valid Yahoo `source_symbol`, run `make db-seed`, `make ingest-markets`, `make compute-signals`. Add the symbol to `SOURCE_ASSETS` in `src/lib/events/enrich.ts` if it should appear in event studies.

**New macro indicator**: add it to `indicators` in `src/data/seed.ts` with the provider series ID, run `make db-seed` and the matching ingest job. Include it in `US_MACRO_IDS` only if it should influence features.

**New horizon**: use an `Nd` token up to 504 immediately, or add a preset to `src/lib/signals/horizons.ts`. Alert rules accept only `1d`, `1w`, and `1m`.

**New rule weight**: edit `src/lib/signals/score.ts`, bump `SIGNAL_MODEL_VERSION`, then backfill so old and new versions stay comparable in `forecast_log`.

## Deployment

Vercel builds from the default branch. Set the required environment variables in the project settings before the first deploy; the dashboard route is dynamic and reads Turso on every request, so a missing database URL surfaces immediately through `/api/health`. Schema changes are applied by running `npm run db:migrate` against the target database, not by the deploy itself.
