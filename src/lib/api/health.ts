import type { Client } from "@libsql/client";
import { appEnv, isProductionLike } from "@/lib/config";
import { jwtSecretStatus } from "@/lib/security/secrets";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export type CheckStatus = "ok" | "degraded" | "error" | "skip";

export type HealthCheck = {
  status: CheckStatus;
  message?: string;
  latencyMs?: number;
  [key: string]: unknown;
};

export type HealthReport = {
  ok: boolean;
  status: "ok" | "degraded" | "error";
  service: string;
  version: string;
  time: string;
  checks: Record<string, HealthCheck>;
};

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export function checkApp(): HealthCheck {
  return {
    status: "ok",
    message: "Next.js app process responding",
    node: process.version,
    env: process.env.NODE_ENV ?? "unknown",
    appEnv: appEnv(),
  };
}

export function checkConfig(): HealthCheck {
  const tursoUrl = envPresent("TURSO_DATABASE_URL");
  const tursoToken = envPresent("TURSO_AUTH_TOKEN");
  const jwt = jwtSecretStatus();
  const fred = envPresent("FRED_API_KEY");
  const finnhub = envPresent("FINNHUB_API_KEY");
  const gemini = envPresent("GEMINI_API_KEY");
  const groq = envPresent("GROQ_API_KEY");
  const smtp =
    envPresent("SMTP_HOST") &&
    envPresent("SMTP_USER") &&
    envPresent("SMTP_PASSWORD");

  const requiredOk = tursoUrl && tursoToken && jwt.present;
  const missingRequired: string[] = [];
  if (!tursoUrl) missingRequired.push("TURSO_DATABASE_URL");
  if (!tursoToken) missingRequired.push("TURSO_AUTH_TOKEN");
  if (!jwt.present) missingRequired.push("JWT_SECRET");

  let status: CheckStatus = requiredOk ? "ok" : "error";
  let message = requiredOk
    ? "Required env present (values not exposed)"
    : `Missing required env: ${missingRequired.join(", ")}`;

  if (requiredOk && !jwt.strong) {
    status = isProductionLike() ? "error" : "degraded";
    message = jwt.message;
  }

  return {
    status,
    message,
    required: {
      TURSO_DATABASE_URL: tursoUrl,
      TURSO_AUTH_TOKEN: tursoToken,
      JWT_SECRET: jwt.present,
    },
    optional: {
      FRED_API_KEY: fred,
      FINNHUB_API_KEY: finnhub,
      GEMINI_API_KEY: gemini,
      GROQ_API_KEY: groq,
      SMTP: smtp,
      JWT_SECRET_STRONG: jwt.strong,
    },
  };
}

export async function checkDatabase(db: Client): Promise<HealthCheck> {
  const started = Date.now();
  try {
    await db.execute("SELECT 1 AS ok");
    return {
      status: "ok",
      message: "Turso reachable",
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Database query failed",
      latencyMs: Date.now() - started,
    };
  }
}

export async function checkDataFreshness(db: Client): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const [signals, readings, assets, events, latest] = await Promise.all([
      db.execute("SELECT COUNT(*) AS n FROM signals"),
      db.execute("SELECT COUNT(*) AS n FROM readings"),
      db.execute("SELECT COUNT(*) AS n FROM asset_readings"),
      db.execute("SELECT COUNT(*) AS n FROM events"),
      db.execute({
        sql: `SELECT MAX(as_of_date) AS d FROM signals WHERE model_version = ?`,
        args: [SIGNAL_MODEL_VERSION],
      }),
    ]);

    const signalCount = Number(signals.rows[0]?.n ?? 0);
    const readingCount = Number(readings.rows[0]?.n ?? 0);
    const assetCount = Number(assets.rows[0]?.n ?? 0);
    const eventCount = Number(events.rows[0]?.n ?? 0);
    const latestAsOf =
      latest.rows[0]?.d == null ? null : String(latest.rows[0].d);

    let status: CheckStatus = "ok";
    let message = "Core tables populated";

    if (readingCount === 0 || assetCount === 0) {
      status = "degraded";
      message = "Missing macro or market history — run ingest";
    } else if (signalCount === 0) {
      status = "degraded";
      message = "No signals yet — run make compute-signals";
    }

    return {
      status,
      message,
      latencyMs: Date.now() - started,
      counts: {
        signals: signalCount,
        readings: readingCount,
        assetReadings: assetCount,
        events: eventCount,
      },
      latestSignalAsOf: latestAsOf,
      modelVersion: SIGNAL_MODEL_VERSION,
    };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Data check failed",
      latencyMs: Date.now() - started,
    };
  }
}

export async function checkYahooReachable(
  fetchImpl: typeof fetch = fetch,
): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=5d";
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent": "TellMacroBot/0.1 (health)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return {
        status: "degraded",
        message: `Yahoo HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }
    return {
      status: "ok",
      message: "Yahoo chart reachable",
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: "degraded",
      message: err instanceof Error ? err.message : "Yahoo unreachable",
      latencyMs: Date.now() - started,
    };
  }
}

export async function checkFinnhubQuote(
  fetchImpl: typeof fetch = fetch,
): Promise<HealthCheck> {
  if (!envPresent("FINNHUB_API_KEY")) {
    return {
      status: "skip",
      message: "FINNHUB_API_KEY not configured",
    };
  }

  const started = Date.now();
  try {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", "AAPL");
    url.searchParams.set("token", process.env.FINNHUB_API_KEY!);
    const res = await fetchImpl(url, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return {
        status: "degraded",
        message: `Finnhub HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as { c?: number };
    if (!Number.isFinite(data.c)) {
      return {
        status: "degraded",
        message: "Finnhub quote missing price",
        latencyMs: Date.now() - started,
      };
    }
    return {
      status: "ok",
      message: "Finnhub quote OK",
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    return {
      status: "degraded",
      message: err instanceof Error ? err.message : "Finnhub unreachable",
      latencyMs: Date.now() - started,
    };
  }
}

export function aggregateStatus(
  checks: Record<string, HealthCheck>,
): "ok" | "degraded" | "error" {
  const values = Object.values(checks).map((c) => c.status);
  if (values.includes("error")) return "error";
  if (values.includes("degraded")) return "degraded";
  return "ok";
}

export async function buildHealthReport(
  db: Client | null,
  options?: { deep?: boolean; fetchImpl?: typeof fetch; version?: string },
): Promise<HealthReport> {
  const checks: Record<string, HealthCheck> = {
    app: checkApp(),
    config: checkConfig(),
  };

  if (!db) {
    checks.database = {
      status: "error",
      message: "Database client unavailable (missing env?)",
    };
  } else {
    checks.database = await checkDatabase(db);
    if (checks.database.status === "ok") {
      checks.data = await checkDataFreshness(db);
    } else {
      checks.data = {
        status: "skip",
        message: "Skipped because database is down",
      };
    }
  }

  if (options?.deep) {
    const fetchImpl = options.fetchImpl ?? fetch;
    const [yahoo, finnhub] = await Promise.all([
      checkYahooReachable(fetchImpl),
      checkFinnhubQuote(fetchImpl),
    ]);
    checks.yahoo = yahoo;
    checks.finnhub = finnhub;
  }

  const status = aggregateStatus(checks);
  return {
    ok: status !== "error",
    status,
    service: "tell",
    version: options?.version ?? process.env.npm_package_version ?? "0.1.0",
    time: new Date().toISOString(),
    checks,
  };
}

/** HTTP status: 503 only when critical (app config/db error). */
export function healthHttpStatus(report: HealthReport): number {
  return report.status === "error" ? 503 : 200;
}
