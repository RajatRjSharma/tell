/**
 * Horizon tokens map to trading-session lookbacks (daily bars).
 * Presets: 1d→1, 1w→5, 1m→21. Custom: 10d, 60d, 2w (10 sessions).
 */

export const DEFAULT_HORIZONS = ["1d", "1w", "1m"] as const;

const PRESET_BARS: Record<string, number> = {
  "1d": 1,
  "1w": 5,
  "2w": 10,
  "1m": 21,
  "3m": 63,
  "6m": 126,
  "1y": 252,
};

/** Parse a horizon token into trading-day bar count. */
export function horizonToBars(token: string): number {
  const key = token.trim().toLowerCase();
  if (!key) {
    throw new Error("Empty horizon token");
  }

  if (PRESET_BARS[key] != null) {
    return PRESET_BARS[key]!;
  }

  const match = /^(\d+)d$/.exec(key);
  if (match) {
    const n = Number(match[1]);
    if (!Number.isInteger(n) || n < 1 || n > 504) {
      throw new Error(`Horizon out of range: ${token}`);
    }
    return n;
  }

  throw new Error(
    `Unknown horizon "${token}". Use presets (1d,1w,1m,2w,3m,6m,1y) or Nd (e.g. 10d).`,
  );
}

export function parseHorizons(raw: string | undefined): string[] {
  const source = raw?.trim() ? raw : DEFAULT_HORIZONS.join(",");
  const parts = source
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  if (parts.length === 0) {
    return [...DEFAULT_HORIZONS];
  }

  // Validate early
  for (const p of parts) {
    horizonToBars(p);
  }

  return [...new Set(parts)];
}

/** Momentum feature field closest to the horizon bar count. */
export function momentumFieldForBars(
  bars: number,
): "return1d" | "return5d" | "return21d" {
  if (bars <= 2) return "return1d";
  if (bars <= 10) return "return5d";
  return "return21d";
}
