import type { ParsedReading } from "@/lib/fred";
import {
  fetchImfCountryReadings as fetchImfOnly,
  type ImfDatamapperResponse,
} from "@/lib/imf";
import { fetchWorldBankIndicator, worldBankIdForImf } from "@/lib/worldbank";

export type CrossCountrySource = "IMF" | "WorldBank";

export type CrossCountryResult = {
  source: CrossCountrySource;
  byCountry: Record<string, ParsedReading[]>;
};

/**
 * Prefer IMF DataMapper; fall back to World Bank when IMF blocks cloud IPs (403).
 * Indicator ids in Tell stay the same; readings.source records the provider used.
 */
export async function fetchCrossCountryReadings(
  imfIndicatorCode: string,
  countryCodes: string[],
  options?: {
    fetchImpl?: typeof fetch;
    minYear?: number;
    maxYear?: number;
  },
): Promise<CrossCountryResult> {
  try {
    const byCountry = await fetchImfOnly(
      imfIndicatorCode,
      countryCodes,
      options,
    );
    return { source: "IMF", byCountry };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const wbId = worldBankIdForImf(imfIndicatorCode);
    if (!wbId) throw err;

    console.warn(
      `IMF unavailable for ${imfIndicatorCode} (${message}); falling back to World Bank ${wbId}`,
    );

    const byCountry = await fetchWorldBankIndicator(wbId, countryCodes, {
      fetchImpl: options?.fetchImpl,
      minYear: options?.minYear,
      maxYear: options?.maxYear,
    });

    return { source: "WorldBank", byCountry };
  }
}

export type { ImfDatamapperResponse };
