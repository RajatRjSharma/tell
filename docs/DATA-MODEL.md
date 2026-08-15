# Data model

Schema source: `db/schema.sql`. Every statement is idempotent (`CREATE TABLE IF NOT EXISTS`), so `npm run db:migrate` can be re-run safely. `PRAGMA foreign_keys = ON` is set at the top of the file.

## Table overview

| Table | Grain | Written by |
| ----- | ----- | ---------- |
| `countries` | One row per country | `db:seed` |
| `indicators` | One row per macro indicator | `db:seed` |
| `readings` | Country, indicator, observation date, vintage | `ingest:fred`, `ingest:imf` |
| `assets` | One row per tradable symbol | `db:seed` |
| `asset_readings` | Symbol and trading date | `ingest:markets` |
| `signals` | Symbol, horizon, as-of date, model version | `compute:signals`, `backfill:signals` |
| `forecast_log` | Same key as `signals` | `compute:forecasts` |
| `events` | One row per policy item | `ingest:events` |
| `users` | One row per account | Registration routes |
| `auth_otps` | Latest code per email and purpose | OTP request route |
| `watchlist_items` | User and symbol | Watchlist API |
| `alert_rules` | User rule definition | Alerts API |
| `alert_events` | Rule and as-of date | `compute:alerts` |
| `research_briefs` | Symbol, horizon, as-of date, model | Brief generation |
| `ai_briefs` | Legacy brief store | Reserved |
| `research_fts` | Retrieval documents | Event and brief writes |

## Reference data

### `countries`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `code` | TEXT | Primary key, ISO-2 |
| `name` | TEXT | Required |
| `region` | TEXT | Optional grouping |
| `currency` | TEXT | Optional |
| `created_at` | TEXT | Defaults to `datetime('now')` |

### `indicators`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | TEXT | Primary key, for example `CPI` |
| `name` | TEXT | Display name |
| `unit` | TEXT | Index, percent, level |
| `frequency` | TEXT | Daily, monthly, quarterly, annual |
| `source` | TEXT | `FRED` or `IMF` |
| `source_series_id` | TEXT | Provider series identifier |
| `description` | TEXT | Optional |
| `created_at` | TEXT | Default timestamp |

### `assets`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `symbol` | TEXT | Primary key, internal symbol |
| `name` | TEXT | Display name |
| `asset_class` | TEXT | `equity`, `fx`, `commodity`, `rates` |
| `country_code` | TEXT | References `countries(code)` |
| `currency` | TEXT | Quote currency |
| `source_symbol` | TEXT | Yahoo ticker, FX uses `=X` pairs |
| `created_at` | TEXT | Default timestamp |

## Time series

### `readings`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `country_code` | TEXT | References `countries(code)` |
| `indicator_id` | TEXT | References `indicators(id)` |
| `observed_for` | TEXT | Observation date |
| `value` | REAL | Required |
| `released_at` | TEXT | Publication date when known |
| `vintage` | TEXT | `current`, or an ALFRED `realtime_start` date |
| `source` | TEXT | `FRED`, `ALFRED`, `IMF`, `WorldBank` |
| `fetched_at` | TEXT | Default timestamp |

Unique key: `(country_code, indicator_id, observed_for, vintage)`.
Index: `idx_readings_lookup (country_code, indicator_id, observed_for DESC)`.

Upsert rules in `src/lib/readings.ts`:

- The default vintage constant is `current`; ALFRED rows carry the release date as their vintage, so revisions accumulate rather than overwrite.
- Conflicting rows update `value`, `released_at`, `source`, and `fetched_at`, but only when the incoming source is `IMF` or the stored source is not `IMF`. World Bank data therefore cannot overwrite true IMF WEO rows.
- Feature loading and reading queries filter on `vintage = 'current'`, so vintage history never leaks into live scoring.

### `asset_readings`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `symbol` | TEXT | References `assets(symbol)` |
| `date` | TEXT | Trading date |
| `open`, `high`, `low` | REAL | Optional |
| `close` | REAL | Required |
| `volume` | REAL | Optional |
| `fetched_at` | TEXT | Default timestamp |

Unique key: `(symbol, date)`. Index: `idx_asset_readings_lookup (symbol, date DESC)`.

Trading dates come from this table, so horizons count observations rather than calendar days.

## Outlook and evaluation

### `signals`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `symbol` | TEXT | References `assets(symbol)` |
| `horizon` | TEXT | `1d`, `1w`, `1m`, or `Nd` |
| `as_of_date` | TEXT | Scoring date |
| `score` | REAL | Clamped to the range -1 to 1 |
| `direction` | TEXT | Constrained to `bullish`, `neutral`, `bearish` |
| `confidence` | REAL | Range 0.2 to 0.9 |
| `drivers_json` | TEXT | Serialized driver list with codes, details, weights |
| `regime` | TEXT | Regime label at scoring time |
| `model_version` | TEXT | `rules-v1` |
| `created_at` | TEXT | Default timestamp |

Unique key: `(symbol, horizon, as_of_date, model_version)`. Index: `idx_signals_lookup (symbol, horizon, as_of_date DESC)`.

### `forecast_log`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `symbol`, `horizon`, `as_of_date` | TEXT | Mirrors the scored signal |
| `direction` | TEXT | Direction being graded |
| `score`, `confidence` | REAL | Copied from the signal |
| `actual_return` | REAL | Realized forward return, null until resolvable |
| `correct` | INTEGER | 1, 0, or null |
| `model_version` | TEXT | Defaults to `rules-v1` |
| `evaluated_at` | TEXT | Set when graded |
| `created_at` | TEXT | Default timestamp |

Unique key: `(symbol, horizon, as_of_date, model_version)`. Index: `idx_forecast_log_lookup (symbol, horizon, as_of_date DESC)`.

## Events

### `events`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | TEXT | Primary key, stable hash of the feed item |
| `date` | TEXT | Publication date |
| `country_code` | TEXT | References `countries(code)` |
| `type` | TEXT | For example policy, speech, data |
| `title` | TEXT | Required |
| `summary` | TEXT | Optional |
| `url` | TEXT | Source link |
| `sentiment` | REAL | Keyword tone, positive means hawkish |
| `assets_impact_json` | TEXT | JSON array of affected symbols |
| `source` | TEXT | `Fed`, `ECB`, `BoE` |
| `created_at` | TEXT | Default timestamp |

Index: `idx_events_date (date DESC)`. Upserts refresh every mutable column and then index the event for retrieval.

Symbol filtering uses a JSON `LIKE` match on `assets_impact_json`, so symbol values are uppercased before querying.

## Accounts and personalization

### `users`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | TEXT | Primary key, UUID |
| `email` | TEXT | Unique, stored normalized |
| `password_hash` | TEXT | bcrypt hash |
| `created_at` | TEXT | Default timestamp |

### `auth_otps`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `email` | TEXT | Target address |
| `purpose` | TEXT | Currently `register` |
| `code_hash` | TEXT | SHA-256 of the code |
| `expires_at` | TEXT | ISO expiry |
| `attempts` | INTEGER | Failed verification count |
| `created_at` | TEXT | Default timestamp |

Index: `idx_auth_otps_lookup (email, purpose, created_at DESC)`. Requesting a new code deletes prior rows for that email and purpose, so only the newest code is valid.

### `watchlist_items`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `user_id` | TEXT | Session subject |
| `symbol` | TEXT | Uppercased symbol |
| `created_at` | TEXT | Default timestamp |

Unique key: `(user_id, symbol)`; inserts use conflict-ignore so adding twice is harmless. Index: `idx_watchlist_user (user_id, created_at ASC)`.

### `alert_rules`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `user_id` | TEXT | Owner |
| `symbol`, `horizon` | TEXT | Target signal |
| `rule_type` | TEXT | `direction_change`, `became_direction`, `confidence_below` |
| `rule_value` | TEXT | Direction name or confidence threshold |
| `enabled` | INTEGER | Defaults to 1 |
| `last_triggered_at` | TEXT | Last fire timestamp |
| `last_seen_direction` | TEXT | Baseline direction |
| `last_seen_confidence` | REAL | Baseline confidence |
| `last_seen_as_of` | TEXT | Baseline signal date |
| `created_at` | TEXT | Default timestamp |

Indexes: `idx_alert_rules_user (user_id, enabled)` and `idx_alert_rules_eval (enabled, symbol, horizon)`.

### `alert_events`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | INTEGER | Autoincrement |
| `rule_id` | INTEGER | Source rule |
| `user_id` | TEXT | Recipient |
| `symbol`, `horizon`, `rule_type` | TEXT | Context |
| `title`, `body` | TEXT | Rendered copy |
| `signal_direction` | TEXT | Direction at fire time |
| `signal_confidence` | REAL | Confidence at fire time |
| `as_of_date` | TEXT | Signal date |
| `read_at` | TEXT | Null while unread |
| `created_at` | TEXT | Default timestamp |

Unique key: `(rule_id, as_of_date)`, which makes evaluation idempotent per day. Index: `idx_alert_events_user (user_id, created_at DESC)`.

## Research storage

### `research_briefs`

| Column | Type | Notes |
| ------ | ---- | ----- |
| `symbol` | TEXT | Symbol, or `_MARKET` for cross-asset briefs |
| `horizon` | TEXT | Brief horizon |
| `as_of_date` | TEXT | Evidence date |
| `title`, `summary` | TEXT | Required |
| `bullets_json`, `risks_json` | TEXT | JSON string arrays |
| `model` | TEXT | Generating model |
| `provider` | TEXT | Defaults to `gemini` |
| `created_at` | TEXT | Default timestamp |

Unique key: `(symbol, horizon, as_of_date, model)`. Index: `idx_research_briefs_lookup (symbol, horizon, as_of_date DESC)`. Conflicts refresh the content and bump `created_at`.

### `ai_briefs`

Earlier free-text brief table keyed by `(as_of_date, horizon, model)`. Retained by the schema; current code writes `research_briefs`.

### `research_fts`

FTS5 virtual table with `porter` tokenizer and columns `kind`, `ref_id`, `title`, `body`.

- `kind` is `event` or `brief`.
- `ref_id` is the event ID, or `symbol:horizon:asOf` for briefs.
- Writes delete then insert, keeping one document per `kind` and `ref_id`.
- Search builds a prefix `OR` query from up to eight terms of two or more characters and returns at most the requested number of hits ordered by rank.
- Both indexing and search swallow errors, so retrieval degrades quietly if the table is absent.

SQLite creates the shadow tables `research_fts_config`, `research_fts_content`, `research_fts_data`, `research_fts_docsize`, and `research_fts_idx`. They are managed automatically.

## Conventions

- Dates are `YYYY-MM-DD` strings; timestamps are SQLite `datetime('now')` or ISO strings.
- Symbols are uppercase and validated against `/^[A-Z0-9.=_-]{1,20}$/` before reaching SQL.
- Every query uses bound parameters.
- Batched reading upserts write 100 rows per statement by default.
- User-scoped tables filter on `user_id` from the verified session, never from request input.
