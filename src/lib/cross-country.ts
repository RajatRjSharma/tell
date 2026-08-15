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
 * Prefer IMF DataMapper; fall back to World Bank on 403.
 * `CROSS_COUNTRY_PROVIDER`: auto | imf | worldbank
 */
export async function fetchCrossCountryReadings(
  imfIndicatorCode: string,
  countryCodes: string[],
  options?: {
    fetchImpl?: typeof fetch;
    minYear?: number;
    maxYear?: number;
    provider?: "auto" | "IMF" | "WorldBank" | "imf" | "worldbank";
  },
): Promise<CrossCountryResult> {
  const raw = options?.provider ?? process.env.CROSS_COUNTRY_PROVIDER ?? "auto";
  const provider = String(raw).toLowerCase();

  if (provider === "worldbank") {
    const wbId = worldBankIdForImf(imfIndicatorCode);
    if (!wbId) {
      throw new Error(`No World Bank mapping for ${imfIndicatorCode}`);
    }
    const byCountry = await fetchWorldBankIndicator(wbId, countryCodes, {
      fetchImpl: options?.fetchImpl,
      minYear: options?.minYear,
      maxYear: options?.maxYear,
    });
    return { source: "WorldBank", byCountry };
  }

  try {
    const byCountry = await fetchImfOnly(
      imfIndicatorCode,
      countryCodes,
      options,
    );
    return { source: "IMF", byCountry };
  } catch (err) {
    if (provider === "imf") throw err;

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
