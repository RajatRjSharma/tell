import type { ParsedReading } from "@/lib/fred";
import { resilientFetch } from "@/lib/http/fetch-retry";
import { sdmxPeriodToObservedFor } from "@/lib/imf-sdmx";

const BIS_BASE = "https://stats.bis.org/api/v2/data/dataflow/BIS";

/** Germany has no national policy rate; it follows the ECB (BIS area XM). */
export const BIS_POLICY_AREA: Record<string, string> = {
  US: "US",
  IN: "IN",
  DE: "XM",
  JP: "JP",
  GB: "GB",
  CN: "CN",
};

/** Parse BIS `format=csv&detail=dataonly` (FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE). */
export function parseBisPolicyCsv(
  csv: string,
  countryCodes: string[],
): Record<string, ParsedReading[]> {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = (header ?? "").split(",").map((col) => col.trim());
  const areaCol = columns.indexOf("REF_AREA");
  const periodCol = columns.indexOf("TIME_PERIOD");
  const valueCol = columns.indexOf("OBS_VALUE");
  const byCountry: Record<string, ParsedReading[]> = {};
  if (areaCol < 0 || periodCol < 0 || valueCol < 0) return byCountry;

  const areaToCountry = new Map(
    countryCodes
      .filter((code) => BIS_POLICY_AREA[code])
      .map((code) => [BIS_POLICY_AREA[code]!, code]),
  );

  for (const line of lines) {
    const cells = line.split(",");
    const country = areaToCountry.get(cells[areaCol]?.trim() ?? "");
    const observedFor = sdmxPeriodToObservedFor(cells[periodCol]?.trim() ?? "");
    const raw = cells[valueCol]?.trim();
    const value = Number(raw);
    if (!country || !observedFor || !raw || !Number.isFinite(value)) continue;
    (byCountry[country] ??= []).push({ observedFor, value });
  }

  for (const readings of Object.values(byCountry)) {
    readings.sort((a, b) => a.observedFor.localeCompare(b.observedFor));
  }
  return byCountry;
}

/** Monthly end-of-period central bank policy rates (BIS WS_CBPOL). */
export async function fetchBisPolicyRates(
  countryCodes: string[],
  options?: { startPeriod?: string; fetchImpl?: typeof fetch },
): Promise<Record<string, ParsedReading[]>> {
  const fetchImpl = options?.fetchImpl ?? resilientFetch;
  const areas = countryCodes
    .map((code) => BIS_POLICY_AREA[code])
    .filter(Boolean)
    .join("+");
  const params = new URLSearchParams({ format: "csv", detail: "dataonly" });
  if (options?.startPeriod) params.set("startPeriod", options.startPeriod);
  const url = `${BIS_BASE}/WS_CBPOL/1.0/M.${areas}?${params.toString()}`;

  const res = await fetchImpl(url, {
    headers: {
      Accept: "text/csv",
      "User-Agent":
        "Mozilla/5.0 (compatible; TellMacroBot/0.1; +https://github.com/RajatRjSharma/tell)",
    },
  });
  if (!res.ok) {
    throw new Error(`BIS HTTP ${res.status} for WS_CBPOL`);
  }

  return parseBisPolicyCsv(await res.text(), countryCodes);
}
