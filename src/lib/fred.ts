export type FredObservation = {
  date: string;
  value: string;
  realtime_start?: string;
  realtime_end?: string;
};

export type FredObservationsResponse = {
  observations?: FredObservation[];
  error_code?: number;
  error_message?: string;
};

export type ParsedReading = {
  observedFor: string;
  value: number;
  releasedAt?: string | null;
  vintage?: string;
};

const FRED_BASE = "https://api.stlouisfed.org/fred";

export function getFredApiKey(): string {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    throw new Error("Missing FRED_API_KEY");
  }
  return key;
}

/** Parse FRED observations; drop "." / non-numeric. */
export function parseFredObservations(
  observations: FredObservation[],
  options?: { alfred?: boolean },
): ParsedReading[] {
  const readings: ParsedReading[] = [];
  const alfred = options?.alfred === true;

  for (const obs of observations) {
    if (!obs.date || obs.value === "." || obs.value.trim() === "") continue;
    const value = Number(obs.value);
    if (!Number.isFinite(value)) continue;
    const releasedAt = obs.realtime_start?.trim() || null;
    readings.push({
      observedFor: obs.date,
      value,
      releasedAt,
      vintage: alfred && releasedAt ? releasedAt : undefined,
    });
  }

  return readings;
}

export async function fetchFredSeriesObservations(
  seriesId: string,
  options?: {
    apiKey?: string;
    observationStart?: string;
    /** Point-in-time vintage window (ALFRED / FRED realtime). */
    realtimeStart?: string;
    realtimeEnd?: string;
    alfred?: boolean;
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
  if (options?.realtimeStart) {
    url.searchParams.set("realtime_start", options.realtimeStart);
  }
  if (options?.realtimeEnd) {
    url.searchParams.set("realtime_end", options.realtimeEnd);
  }

  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`FRED HTTP ${res.status} for series ${seriesId}`);
  }

  const data = (await res.json()) as FredObservationsResponse;
  if (data.error_message) {
    throw new Error(`FRED error for ${seriesId}: ${data.error_message}`);
  }

  return parseFredObservations(data.observations ?? [], {
    alfred: options?.alfred,
  });
}

/** US series with useful ALFRED revision history. */
export const ALFRED_PRIORITY_SERIES = [
  "CPIAUCSL",
  "UNRATE",
  "INDPRO",
  "GDPC1",
] as const;
