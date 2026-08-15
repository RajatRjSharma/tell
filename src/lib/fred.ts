export type FredObservation = {
  date: string;
  value: string;
};

export type FredObservationsResponse = {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
};

export type ParsedReading = {
  observedFor: string;
  value: number;
};

const FRED_BASE = "https://api.stlouisfed.org/fred";

export function getFredApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    throw new Error("Missing FRED_API_KEY");
  }
  return key;
}

/** Parse FRED observation rows; skip missing "." values and non-numeric. */
export function parseFredObservations(
  observations: FredObservation[],
): ParsedReading[] {
  const readings: ParsedReading[] = [];

  for (const obs of observations) {
    if (!obs.date || obs.value === "." || obs.value.trim() === "") continue;
    const value = Number(obs.value);
    if (!Number.isFinite(value)) continue;
    readings.push({ observedFor: obs.date, value });
  }

  return readings;
}

export async function fetchFredSeriesObservations(
  seriesId: string,
  options?: {
    apiKey?: string;
    observationStart?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<ParsedReading[]> {
  const apiKey = options?.apiKey ?? getFredApiKey();
  const fetchImpl = options?.fetchImpl ?? fetch;

  const url = new URL(`${FRED_BASE}/series/observations`);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("file_type", "json");
  if (options?.observationStart) {
    url.searchParams.set("observation_start", options.observationStart);
  }

  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`FRED HTTP ${res.status} for series ${seriesId}`);
  }

  const data = (await res.json()) as FredObservationsResponse;
  if (data.error_message) {
    throw new Error(`FRED error for ${seriesId}: ${data.error_message}`);
  }

  return parseFredObservations(data.observations ?? []);
}
