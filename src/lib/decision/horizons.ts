import { horizonToBars } from "@/lib/signals/horizons";

export type HorizonPlain = {
  token: string;
  bars: number;
  shortLabel: string;
  longLabel: string;
  beginnerLabel: string;
};

const LABELS: Record<string, Omit<HorizonPlain, "token" | "bars">> = {
  "1d": {
    shortLabel: "Next session",
    longLabel: "About 1 trading session ahead",
    beginnerLabel: "Next market session",
  },
  "1w": {
    shortLabel: "~1 week",
    longLabel: "About 5 trading sessions ahead",
    beginnerLabel: "About the next week of trading",
  },
  "2w": {
    shortLabel: "~2 weeks",
    longLabel: "About 10 trading sessions ahead",
    beginnerLabel: "About the next two weeks of trading",
  },
  "1m": {
    shortLabel: "~1 month",
    longLabel: "About 21 trading sessions ahead",
    beginnerLabel: "About the next month of trading",
  },
  "3m": {
    shortLabel: "~3 months",
    longLabel: "About 63 trading sessions ahead",
    beginnerLabel: "About the next three months of trading",
  },
  "6m": {
    shortLabel: "~6 months",
    longLabel: "About 126 trading sessions ahead",
    beginnerLabel: "About the next six months of trading",
  },
  "1y": {
    shortLabel: "~1 year",
    longLabel: "About 252 trading sessions ahead",
    beginnerLabel: "About the next year of trading",
  },
};

/** Human labels for horizon tokens. Trading sessions, not calendar days. */
export function describeHorizon(token: string): HorizonPlain {
  const key = token.trim().toLowerCase();
  const bars = horizonToBars(key);
  const preset = LABELS[key];
  if (preset) {
    return { token: key, bars, ...preset };
  }
  return {
    token: key,
    bars,
    shortLabel: `${bars} sessions`,
    longLabel: `About ${bars} trading sessions ahead`,
    beginnerLabel: `About the next ${bars} trading sessions`,
  };
}

export function formatHorizonOption(token: string): string {
  const d = describeHorizon(token);
  return `${d.shortLabel} (${token})`;
}
