import type { Client } from "@libsql/client";
import { CURRENT_VINTAGE } from "@/lib/readings";

export const LOCAL_MACRO_INDICATORS = ["CPI_YOY_M", "POLICY_RATE"] as const;

export type LocalMacroPoint = {
  value: number;
  asOf: string;
  /** Change vs ~12 months earlier, in percentage points. */
  change12m: number | null;
};

export type LocalMacroRow = {
  countryCode: string;
  inflation: LocalMacroPoint | null;
  policyRate: LocalMacroPoint | null;
  /** Policy rate minus inflation when both exist. */
  realRate: number | null;
};

export type LocalMacroReading = {
  countryCode: string;
  indicatorId: string;
  observedFor: string;
  value: number;
};

function shiftMonths(isoDate: string, months: number): string {
  const [year, month] = isoDate.split("-").map(Number);
  const total = year! * 12 + (month! - 1) + months;
  const y = Math.floor(total / 12);
  const m = String((total % 12) + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function latestPoint(series: LocalMacroReading[]): LocalMacroPoint | null {
  const latest = series[series.length - 1];
  if (!latest) return null;
  const target = shiftMonths(latest.observedFor, -12);
  const prior = series.find((row) => row.observedFor === target);
  return {
    value: latest.value,
    asOf: latest.observedFor,
    change12m: prior ? latest.value - prior.value : null,
  };
}

/** Latest local inflation + policy rate per country (rows in any order). */
export function summarizeLocalMacro(
  readings: LocalMacroReading[],
  countryCodes: string[],
): LocalMacroRow[] {
  const sorted = [...readings].sort((a, b) =>
    a.observedFor.localeCompare(b.observedFor),
  );

  return countryCodes.map((countryCode) => {
    const forCountry = sorted.filter((row) => row.countryCode === countryCode);
    const inflation = latestPoint(
      forCountry.filter((row) => row.indicatorId === "CPI_YOY_M"),
    );
    const policyRate = latestPoint(
      forCountry.filter((row) => row.indicatorId === "POLICY_RATE"),
    );
    return {
      countryCode,
      inflation,
      policyRate,
      realRate:
        inflation && policyRate ? policyRate.value - inflation.value : null,
    };
  });
}

export async function getLocalMacro(
  db: Client,
  countryCodes: string[],
): Promise<LocalMacroRow[]> {
  const result = await db.execute({
    sql: `SELECT country_code, indicator_id, observed_for, value
          FROM readings
          WHERE indicator_id IN (?, ?)
            AND vintage = ?
            AND observed_for >= date('now', '-30 months')`,
    args: [...LOCAL_MACRO_INDICATORS, CURRENT_VINTAGE],
  });

  return summarizeLocalMacro(
    result.rows.map((row) => ({
      countryCode: String(row.country_code),
      indicatorId: String(row.indicator_id),
      observedFor: String(row.observed_for),
      value: Number(row.value),
    })),
    countryCodes,
  );
}
