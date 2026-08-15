import type { ParsedReading } from "@/lib/fred";
import { yearToObservedFor } from "@/lib/imf";

/** IMF WEO DataMapper codes → World Bank open API indicator ids (close substitutes). */
export const IMF_TO_WORLDBANK: Record<string, string> = {
  NGDP_RPCH: "NY.GDP.MKTP.KD.ZG", // real GDP growth %
  PCPIPCH: "FP.CPI.TOTL.ZG", // CPI inflation %
  LUR: "SL.UEM.TOTL.ZS", // unemployment %
  BCA_NGDPD: "BN.CAB.XOKA.GD.ZS", // current account % of GDP
};

export type WorldBankObservation = {
  country?: { id?: string };
  date?: string;
  value?: number | null;
};

export type WorldBankResponse = [
  { page?: number; pages?: number; total?: number } | null,
  WorldBankObservation[] | null,
];

const WB_BASE = "https://api.worldbank.org/v2";

export function parseWorldBankObservations(
  rows: WorldBankObservation[],
  countryCodes: string[],
  options?: { minYear?: number; maxYear?: number },
): Record<string, ParsedReading[]> {
  const allowed = new Set(countryCodes);
  const minYear = options?.minYear ?? 2015;
  const maxYear = options?.maxYear ?? new Date().getUTCFullYear() + 1;
  const byCountry: Record<string, ParsedReading[]> = {};

  for (const code of countryCodes) {
    byCountry[code] = [];
  }

  for (const row of rows) {
    const iso2 = row.country?.id;
    if (!iso2 || !allowed.has(iso2)) continue;
    if (row.value === null || row.value === undefined) continue;

    const year = Number(row.date);
    if (!Number.isFinite(year) || year < minYear || year > maxYear) continue;

    const value = Number(row.value);
    if (!Number.isFinite(value)) continue;

    byCountry[iso2]!.push({
      observedFor: yearToObservedFor(year),
      value,
    });
  }

  for (const code of Object.keys(byCountry)) {
    byCountry[code]!.sort((a, b) => a.observedFor.localeCompare(b.observedFor));
  }

  return byCountry;
}

export async function fetchWorldBankIndicator(
  worldBankId: string,
  countryCodes: string[],
  options?: {
    fetchImpl?: typeof fetch;
    minYear?: number;
    maxYear?: number;
  },
): Promise<Record<string, ParsedReading[]>> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const minYear = options?.minYear ?? 2015;
  const maxYear = options?.maxYear ?? new Date().getUTCFullYear() + 1;

  const countries = countryCodes.join(";");
  const url = new URL(
    `${WB_BASE}/country/${countries}/indicator/${encodeURIComponent(worldBankId)}`,
  );
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "20000");
  url.searchParams.set("date", `${minYear}:${maxYear}`);

  const res = await fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "TellMacroBot/0.1 (research; ingest)",
    },
  });

  if (!res.ok) {
    throw new Error(`World Bank HTTP ${res.status} for ${worldBankId}`);
  }

  const payload = (await res.json()) as WorldBankResponse;
  const rows = payload[1];
  if (!Array.isArray(rows)) {
    throw new Error(`World Bank response missing data for ${worldBankId}`);
  }

  return parseWorldBankObservations(rows, countryCodes, { minYear, maxYear });
}

export function worldBankIdForImf(imfCode: string): string | undefined {
  return IMF_TO_WORLDBANK[imfCode];
}
