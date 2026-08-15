-- Tell schema (Turso / libSQL / SQLite)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT,
  currency TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS indicators (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT,
  frequency TEXT,
  source TEXT,
  source_series_id TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL REFERENCES countries(code),
  indicator_id TEXT NOT NULL REFERENCES indicators(id),
  observed_for TEXT NOT NULL,
  value REAL NOT NULL,
  released_at TEXT,
  vintage TEXT,
  source TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (country_code, indicator_id, observed_for, vintage)
);

CREATE INDEX IF NOT EXISTS idx_readings_lookup
  ON readings (country_code, indicator_id, observed_for DESC);

CREATE TABLE IF NOT EXISTS assets (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  currency TEXT,
  source_symbol TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS asset_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL REFERENCES assets(symbol),
  date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL NOT NULL,
  volume REAL,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_asset_readings_lookup
  ON asset_readings (symbol, date DESC);

CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL REFERENCES assets(symbol),
  horizon TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  score REAL NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('bullish', 'neutral', 'bearish')),
  confidence REAL,
  drivers_json TEXT,
  regime TEXT,
  model_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (symbol, horizon, as_of_date, model_version)
);

CREATE INDEX IF NOT EXISTS idx_signals_lookup
  ON signals (symbol, horizon, as_of_date DESC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  country_code TEXT REFERENCES countries(code),
  type TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  sentiment REAL,
  assets_impact_json TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events (date DESC);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  as_of_date TEXT NOT NULL,
  horizon TEXT,
  title TEXT,
  body TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (as_of_date, horizon, model)
);

CREATE TABLE IF NOT EXISTS research_briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  horizon TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  bullets_json TEXT NOT NULL,
  risks_json TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (symbol, horizon, as_of_date, model)
);

CREATE INDEX IF NOT EXISTS idx_research_briefs_lookup
  ON research_briefs (symbol, horizon, as_of_date DESC);

CREATE TABLE IF NOT EXISTS forecast_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  horizon TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  direction TEXT NOT NULL,
  score REAL,
  confidence REAL,
  actual_return REAL,
  correct INTEGER,
  model_version TEXT NOT NULL DEFAULT 'rules-v1',
  evaluated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (symbol, horizon, as_of_date, model_version)
);

CREATE INDEX IF NOT EXISTS idx_forecast_log_lookup
  ON forecast_log (symbol, horizon, as_of_date DESC);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user
  ON watchlist_items (user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS alert_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  horizon TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_value TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  last_seen_direction TEXT,
  last_seen_confidence REAL,
  last_seen_as_of TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user
  ON alert_rules (user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_alert_rules_eval
  ON alert_rules (enabled, symbol, horizon);

CREATE TABLE IF NOT EXISTS alert_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  horizon TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  signal_direction TEXT,
  signal_confidence REAL,
  as_of_date TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (rule_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_alert_events_user
  ON alert_events (user_id, created_at DESC);
