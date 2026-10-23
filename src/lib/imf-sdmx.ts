import type { ParsedReading } from "@/lib/fred";
import { resilientFetch } from "@/lib/http/fetch-retry";

const IMF_SDMX_BASE = "https://api.imf.org/external/sdmx/3.0/data/dataflow";

/** ISO-2 (our DB) → ISO-3 (IMF SDMX COUNTRY dimension). */
export const SDMX_ISO2_TO_ISO3: Record<string, string> = {
  US: "USA",
  IN: "IND",
  DE: "DEU",
  JP: "JPN",
  GB: "GBR",
  CN: "CHN",
};

/** Headline CPI, all items, year-over-year % change, monthly. */
export const IMF_CPI_YOY_MONTHLY_KEY = "CPI._T.YOY_PCH_PA_PT.M";

type SdmxDimension = {
  id: string;
  values: Array<{ id?: string; value?: string }>;
};

export type ImfSdmxResponse = {
  data?: {
    dataSets?: Array<{
      series?: Record<
        string,
        { observations?: Record<string, Array<string | number | null>> }
      >;
    }>;
    structures?: Array<{
      dimensions?: {
        series?: SdmxDimension[];
        observation?: SdmxDimension[];
      };
    }>;
  };
};

/** "2026-M09" / "2026-09" → "2026-09-01"; "2026" → "2026-01-01". */
export function sdmxPeriodToObservedFor(period: string): string | null {
  const monthly = /^(\d{4})-M?(\d{2})$/.exec(period);
  if (monthly) return `${monthly[1]}-${monthly[2]}-01`;
  const quarterly = /^(\d{4})-Q([1-4])$/.exec(period);
  if (quarterly) {
    const month = String((Number(quarterly[2]) - 1) * 3 + 1).padStart(2, "0");
    return `${quarterly[1]}-${month}-01`;
  }
  if (/^\d{4}$/.test(period)) return `${period}-01-01`;
  return null;
}

/** SDMX-JSON 2.0 payload → readings keyed by ISO-2 country. */
export function parseImfSdmxSeries(
  payload: ImfSdmxResponse,
  countryCodes: string[],
): Record<string, ParsedReading[]> {
  const structure = payload.data?.structures?.[0]?.dimensions;
  const seriesDims = structure?.series ?? [];
  const timeValues = structure?.observation?.[0]?.values ?? [];
  const countryDim = seriesDims.findIndex((dim) => dim.id === "COUNTRY");
  const iso3ToIso2 = new Map(
    countryCodes
      .filter((code) => SDMX_ISO2_TO_ISO3[code])
      .map((code) => [SDMX_ISO2_TO_ISO3[code]!, code]),
  );

  const byCountry: Record<string, ParsedReading[]> = {};
  if (countryDim < 0) return byCountry;

  for (const [key, series] of Object.entries(
    payload.data?.dataSets?.[0]?.series ?? {},
  )) {
    const countryIndex = Number(key.split(":")[countryDim]);
    const iso3 = seriesDims[countryDim]?.values[countryIndex]?.id;
    const iso2 = iso3 ? iso3ToIso2.get(iso3) : undefined;
    if (!iso2) continue;

    const readings = byCountry[iso2] ?? [];
    for (const [obsKey, obs] of Object.entries(series.observations ?? {})) {
      const period = timeValues[Number(obsKey)];
      const observedFor = sdmxPeriodToObservedFor(
        period?.value ?? period?.id ?? "",
      );
      const value = Number(obs?.[0]);
      if (!observedFor || obs?.[0] == null || !Number.isFinite(value)) continue;
      readings.push({ observedFor, value });
    }
    readings.sort((a, b) => a.observedFor.localeCompare(b.observedFor));
    byCountry[iso2] = readings;
  }

  return byCountry;
}

export async function fetchImfSdmxReadings(
  dataflow: string,
  seriesKeySuffix: string,
  countryCodes: string[],
  options?: { startPeriod?: string; fetchImpl?: typeof fetch },
): Promise<Record<string, ParsedReading[]>> {
  const fetchImpl = options?.fetchImpl ?? resilientFetch;
  const areas = countryCodes
    .map((code) => SDMX_ISO2_TO_ISO3[code])
    .filter(Boolean)
    .join("+");
  const params = new URLSearchParams();
  if (options?.startPeriod) {
    params.set("c[TIME_PERIOD]", `ge:${options.startPeriod}`);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const url = `${IMF_SDMX_BASE}/IMF.STA/${dataflow}/+/${areas}.${seriesKeySuffix}${query}`;

  const res = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (compatible; TellMacroBot/0.1; +https://github.com/RajatRjSharma/tell)",
    },
  });
  if (!res.ok) {
    throw new Error(`IMF SDMX HTTP ${res.status} for ${dataflow}`);
  }

  return parseImfSdmxSeries(
    (await res.json()) as ImfSdmxResponse,
    countryCodes,
  );
}
