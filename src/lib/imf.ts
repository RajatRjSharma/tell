import type { ParsedReading } from "@/lib/fred";

export type ImfDatamapperResponse = {
  values?: Record<string, Record<string, Record<string, number | null>>>;
  error?: string;
};

const IMF_BASE = "https://www.imf.org/external/datamapper/api/v1";

/** ISO-2 (our DB) → ISO-3 (IMF DataMapper) */
export const ISO2_TO_ISO3: Record<string, string> = {
  US: "USA",
  IN: "IND",
  DE: "DEU",
  JP: "JPN",
  GB: "GBR",
};

export const IMF_COUNTRY_CODES = ["US", "IN", "DE", "JP", "GB"] as const;

export function yearToObservedFor(year: string | number): string {
  const y = String(year);
  if (!/^\d{4}$/.test(y)) {
    throw new Error(`Invalid year: ${year}`);
  }
  return `${y}-01-01`;
}

/**
 * Extract annual readings for selected ISO-2 countries from an IMF DataMapper payload.
 */
export function parseImfIndicatorValues(
  indicatorCode: string,
  payload: ImfDatamapperResponse,
  countryCodes: string[],
  options?: { minYear?: number; maxYear?: number },
): Record<string, ParsedReading[]> {
  const byCountry: Record<string, ParsedReading[]> = {};
  const series = payload.values?.[indicatorCode] ?? {};
  const minYear = options?.minYear ?? 2015;
  const maxYear = options?.maxYear ?? new Date().getUTCFullYear() + 1;

  for (const iso2 of countryCodes) {
    const iso3 = ISO2_TO_ISO3[iso2];
    if (!iso3) continue;

    const yearMap = series[iso3] ?? {};
    const readings: ParsedReading[] = [];

    for (const [year, raw] of Object.entries(yearMap)) {
      const y = Number(year);
      if (!Number.isFinite(y) || y < minYear || y > maxYear) continue;
      if (raw === null || raw === undefined) continue;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      readings.push({ observedFor: yearToObservedFor(year), value });
    }

    readings.sort((a, b) => a.observedFor.localeCompare(b.observedFor));
    byCountry[iso2] = readings;
  }

  return byCountry;
}

export async function fetchImfIndicator(
  indicatorCode: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<ImfDatamapperResponse> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const url = `${IMF_BASE}/${encodeURIComponent(indicatorCode)}`;

  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`IMF HTTP ${res.status} for indicator ${indicatorCode}`);
  }

  return (await res.json()) as ImfDatamapperResponse;
}

export async function fetchImfCountryReadings(
  indicatorCode: string,
  countryCodes: string[],
  options?: {
    fetchImpl?: typeof fetch;
    minYear?: number;
    maxYear?: number;
  },
): Promise<Record<string, ParsedReading[]>> {
  const payload = await fetchImfIndicator(indicatorCode, {
    fetchImpl: options?.fetchImpl,
  });

  if (!payload.values?.[indicatorCode]) {
    throw new Error(`IMF response missing values for ${indicatorCode}`);
  }

  return parseImfIndicatorValues(indicatorCode, payload, countryCodes, {
    minYear: options?.minYear,
    maxYear: options?.maxYear,
  });
}
