import type { ParsedReading } from "@/lib/fred";
import { resilientFetch } from "@/lib/http/fetch-retry";

const TREASURY_XML =
  "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml";

export type TreasuryCurvePoint = {
  date: string;
  twoYear: number | null;
  tenYear: number | null;
};

function field(block: string, name: string): string | null {
  const match = new RegExp(`<d:${name}[^>]*>([^<]*)</d:${name}>`).exec(block);
  return match?.[1]?.trim() || null;
}

function numberField(block: string, name: string): number | null {
  const raw = field(block, name);
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Parse the daily par yield curve OData/Atom XML feed. */
export function parseTreasuryYieldXml(xml: string): TreasuryCurvePoint[] {
  const points: TreasuryCurvePoint[] = [];
  for (const [, block] of xml.matchAll(
    /<m:properties>([\s\S]*?)<\/m:properties>/g,
  )) {
    const date = field(block!, "NEW_DATE")?.slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    points.push({
      date,
      twoYear: numberField(block!, "BC_2YEAR"),
      tenYear: numberField(block!, "BC_10YEAR"),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

/** Curve points → readings for our FRED-equivalent series ids. */
export function treasuryToReadings(
  points: TreasuryCurvePoint[],
): Record<"DGS2" | "DGS10" | "T10Y2Y", ParsedReading[]> {
  const out = {
    DGS2: [] as ParsedReading[],
    DGS10: [] as ParsedReading[],
    T10Y2Y: [] as ParsedReading[],
  };
  for (const point of points) {
    if (point.twoYear != null) {
      out.DGS2.push({ observedFor: point.date, value: point.twoYear });
    }
    if (point.tenYear != null) {
      out.DGS10.push({ observedFor: point.date, value: point.tenYear });
    }
    if (point.twoYear != null && point.tenYear != null) {
      out.T10Y2Y.push({
        observedFor: point.date,
        value: Number((point.tenYear - point.twoYear).toFixed(2)),
      });
    }
  }
  return out;
}

function yearMonth(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** This month and last month, so the first days of a month still see recent prints. */
export async function fetchRecentTreasuryCurve(options?: {
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<TreasuryCurvePoint[]> {
  const fetchImpl = options?.fetchImpl ?? resilientFetch;
  const now = options?.now ?? new Date();
  const lastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const points: TreasuryCurvePoint[] = [];
  for (const month of [yearMonth(lastMonth), yearMonth(now)]) {
    const url = `${TREASURY_XML}?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`;
    const res = await fetchImpl(url, {
      headers: { Accept: "application/xml" },
    });
    if (!res.ok) {
      throw new Error(`Treasury HTTP ${res.status} for ${month}`);
    }
    points.push(...parseTreasuryYieldXml(await res.text()));
  }
  return points;
}
