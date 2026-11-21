import type { Client } from "@libsql/client";
import type { MapCompany } from "@/data/companies";
import type { AssetBar } from "@/lib/yahoo";
import { periodChanges, type PeriodChanges } from "./changes";

export type CompanySnapshot = {
  symbol: string;
  marketCapUsd: number;
  close: number;
  changes: PeriodChanges;
  asOfDate: string;
};

export type CompanyProfile = { marketCapMillions: number; currency: string };

export type SnapshotDeps = {
  profile: (symbol: string) => Promise<CompanyProfile>;
  bars: (yahooSymbol: string) => Promise<AssetBar[]>;
  /** Units of `currency` per one US dollar. */
  unitsPerUsd: (currency: string) => Promise<number>;
  /** Today's UTC date while the US session is open, else null. */
  openSessionDate: string | null;
};

/** Finnhub `profile2` market cap, in millions of the reporting currency. */
export async function fetchFinnhubProfile(
  symbol: string,
  options: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<CompanyProfile> {
  const url = new URL("https://finnhub.io/api/v1/stock/profile2");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("token", options.apiKey);
  const res = await (options.fetchImpl ?? fetch)(url, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Finnhub profile HTTP ${res.status}`);
  const data = (await res.json()) as {
    marketCapitalization?: number;
    currency?: string;
  };
  if (!data.marketCapitalization || !data.currency) {
    throw new Error("Finnhub profile has no market cap");
  }
  return {
    marketCapMillions: data.marketCapitalization,
    currency: data.currency,
  };
}

/** Pence-quoted currencies (GBp, GBX) as major units plus a divisor. */
export function normalizeCurrency(currency: string): {
  code: string;
  divisor: number;
} {
  if (currency === "GBp" || currency === "GBX") {
    return { code: "GBP", divisor: 100 };
  }
  return { code: currency.toUpperCase(), divisor: 1 };
}

export async function buildCompanySnapshot(
  company: MapCompany,
  deps: SnapshotDeps,
): Promise<CompanySnapshot> {
  const bars = (await deps.bars(company.yahoo ?? company.symbol)).filter(
    (bar) => bar.date !== deps.openSessionDate,
  );
  const last = bars.at(-1);
  if (!last || bars.length < 2) throw new Error("not enough daily bars");

  const profile = await deps.profile(company.symbol);
  const { code, divisor } = normalizeCurrency(profile.currency);
  const unitsPerUsd = code === "USD" ? 1 : await deps.unitsPerUsd(code);
  if (!(unitsPerUsd > 0)) throw new Error(`no FX rate for ${code}`);

  return {
    symbol: company.symbol,
    marketCapUsd: (profile.marketCapMillions * 1e6) / divisor / unitsPerUsd,
    close: last.close,
    changes: periodChanges(bars.map((bar) => bar.close)),
    asOfDate: last.date,
  };
}

export async function upsertCompanySnapshot(
  db: Client,
  snapshot: CompanySnapshot,
): Promise<void> {
  await db.execute({
    sql: `INSERT INTO company_snapshots
            (symbol, market_cap_usd, close, change_1d, change_1w, change_1m,
             as_of_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(symbol) DO UPDATE SET
            market_cap_usd = excluded.market_cap_usd,
            close = excluded.close,
            change_1d = excluded.change_1d,
            change_1w = excluded.change_1w,
            change_1m = excluded.change_1m,
            as_of_date = excluded.as_of_date,
            updated_at = excluded.updated_at`,
    args: [
      snapshot.symbol,
      snapshot.marketCapUsd,
      snapshot.close,
      snapshot.changes["1d"],
      snapshot.changes["1w"],
      snapshot.changes["1m"],
      snapshot.asOfDate,
    ],
  });
}

export async function listCompanySnapshots(
  db: Client,
): Promise<CompanySnapshot[]> {
  const result = await db.execute(
    `SELECT symbol, market_cap_usd, close, change_1d, change_1w, change_1m,
            as_of_date
     FROM company_snapshots`,
  );
  const num = (value: unknown) => (value == null ? null : Number(value));
  return result.rows.map((row) => ({
    symbol: String(row.symbol),
    marketCapUsd: Number(row.market_cap_usd),
    close: Number(row.close),
    changes: {
      "1d": num(row.change_1d),
      "1w": num(row.change_1w),
      "1m": num(row.change_1m),
    },
    asOfDate: String(row.as_of_date),
  }));
}

/** Hours since the most recent snapshot write, or null when there are none. */
export async function companySnapshotAgeHours(
  db: Client,
  now = Date.now(),
): Promise<number | null> {
  const result = await db.execute(
    "SELECT MAX(updated_at) AS t FROM company_snapshots",
  );
  const t = result.rows[0]?.t;
  if (t == null) return null;
  return (now - Date.parse(`${String(t).replace(" ", "T")}Z`)) / 3_600_000;
}
