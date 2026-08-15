import type { MarketFeatures } from "@/lib/features/market";
import type { UsRegime } from "@/lib/features/regime";
import { horizonToBars, momentumFieldForBars } from "./horizons";

export const SIGNAL_MODEL_VERSION = "rules-v1";

export type SignalDirection = "bullish" | "neutral" | "bearish";

export type SignalDriver = {
  code: string;
  detail: string;
  weight: number;
};

export type ScoredSignal = {
  symbol: string;
  assetClass: string;
  horizon: string;
  asOfDate: string;
  score: number;
  direction: SignalDirection;
  confidence: number;
  drivers: SignalDriver[];
  regime: UsRegime;
  modelVersion: string;
};

export type ScoreSignalInput = {
  symbol: string;
  assetClass: string;
  horizon: string;
  asOfDate: string;
  regime: UsRegime;
  market: MarketFeatures;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function directionFromScore(score: number): SignalDirection {
  if (score >= 0.15) return "bullish";
  if (score <= -0.15) return "bearish";
  return "neutral";
}

/** Regime bias by asset class (−1…+1 contribution before weights). */
export function regimeBias(
  regime: UsRegime,
  assetClass: string,
): { bias: number; detail: string } {
  const cls = assetClass.toLowerCase();

  if (regime === "risk_off") {
    if (cls === "equity")
      return { bias: -0.55, detail: "risk_off pressures equities" };
    if (cls === "rates")
      return { bias: 0.35, detail: "flight-to-quality supports duration" };
    if (cls === "commodity")
      return { bias: 0.15, detail: "stress mixed for commodities" };
    if (cls === "fx") return { bias: -0.15, detail: "risk_off can firm USD" };
    return { bias: -0.2, detail: "risk_off cautious bias" };
  }

  if (regime === "inflationary") {
    if (cls === "rates")
      return { bias: -0.45, detail: "hot inflation pressures bonds" };
    if (cls === "commodity")
      return { bias: 0.3, detail: "inflation regime can support commodities" };
    if (cls === "equity")
      return { bias: -0.1, detail: "inflation is mixed for equities" };
    if (cls === "fx") return { bias: 0.1, detail: "rate path can support USD" };
    return { bias: 0, detail: "inflation regime mixed" };
  }

  if (regime === "slowdown") {
    if (cls === "equity")
      return { bias: -0.35, detail: "slowdown weighs on equities" };
    if (cls === "rates")
      return { bias: 0.25, detail: "slowdown can support bonds" };
    if (cls === "commodity")
      return { bias: -0.2, detail: "slowdown can soften commodities" };
    return { bias: -0.1, detail: "slowdown cautious bias" };
  }

  if (regime === "expansion") {
    if (cls === "equity")
      return { bias: 0.4, detail: "expansion supports equities" };
    if (cls === "rates")
      return { bias: -0.15, detail: "expansion can pressure duration" };
    if (cls === "commodity")
      return { bias: 0.15, detail: "expansion supports demand assets" };
    return { bias: 0.1, detail: "expansion mild risk-on" };
  }

  return { bias: 0, detail: "neutral regime" };
}

function momentumContribution(
  market: MarketFeatures,
  bars: number,
): { value: number; detail: string; weight: number } {
  const field = momentumFieldForBars(bars);
  const raw = market[field];
  if (raw === null) {
    return { value: 0, detail: `${field} unavailable`, weight: 0 };
  }

  // Scale: ±3% 1d, ±6% 5d, ±10% 21d ≈ full ±1 before clamp
  const scale = field === "return1d" ? 0.03 : field === "return5d" ? 0.06 : 0.1;
  const value = clamp(raw / scale, -1, 1);
  return {
    value,
    detail: `${field}=${(raw * 100).toFixed(2)}%`,
    weight: 0.45,
  };
}

function volPenalty(market: MarketFeatures): { value: number; detail: string } {
  if (market.vol21d === null) return { value: 0, detail: "vol n/a" };
  // ~25% ann. vol → caution for risk assets
  if (market.vol21d >= 0.35) {
    return {
      value: -0.25,
      detail: `elevated vol ${(market.vol21d * 100).toFixed(0)}%`,
    };
  }
  if (market.vol21d >= 0.25) {
    return {
      value: -0.1,
      detail: `high vol ${(market.vol21d * 100).toFixed(0)}%`,
    };
  }
  return { value: 0, detail: `vol ${(market.vol21d * 100).toFixed(0)}%` };
}

function drawdownContribution(market: MarketFeatures): {
  value: number;
  detail: string;
} {
  if (market.drawdown63d === null) return { value: 0, detail: "dd n/a" };
  if (market.drawdown63d <= -0.1) {
    return {
      value: -0.2,
      detail: `deep drawdown ${(market.drawdown63d * 100).toFixed(1)}%`,
    };
  }
  if (market.drawdown63d <= -0.05) {
    return {
      value: -0.1,
      detail: `drawdown ${(market.drawdown63d * 100).toFixed(1)}%`,
    };
  }
  return { value: 0, detail: `dd ${(market.drawdown63d * 100).toFixed(1)}%` };
}

/** Score in [-1, 1]. */
export function scoreSignal(input: ScoreSignalInput): ScoredSignal {
  const bars = horizonToBars(input.horizon);
  const drivers: SignalDriver[] = [];

  const regime = regimeBias(input.regime, input.assetClass);
  drivers.push({
    code: "regime",
    detail: `${input.regime}: ${regime.detail}`,
    weight: 0.4,
  });

  const mom = momentumContribution(input.market, bars);
  if (mom.weight > 0) {
    drivers.push({
      code: "momentum",
      detail: mom.detail,
      weight: mom.weight,
    });
  }

  const vol = volPenalty(input.market);
  if (vol.value !== 0) {
    drivers.push({ code: "volatility", detail: vol.detail, weight: 0.15 });
  }

  const dd = drawdownContribution(input.market);
  if (dd.value !== 0) {
    drivers.push({ code: "drawdown", detail: dd.detail, weight: 0.1 });
  }

  // Gold tweak for inflation / risk_off
  let symbolBias = 0;
  if (input.symbol === "GLD") {
    if (input.regime === "inflationary" || input.regime === "risk_off") {
      symbolBias = 0.15;
      drivers.push({
        code: "gold_hedge",
        detail: "gold often bid in inflation/stress",
        weight: 0.1,
      });
    }
  }
  if (input.symbol === "TLT" && input.regime === "inflationary") {
    symbolBias = -0.1;
  }
  if (input.symbol === "USO" && input.regime === "slowdown") {
    symbolBias = -0.1;
  }

  const raw =
    regime.bias * 0.4 +
    mom.value * (mom.weight || 0) +
    vol.value * 0.15 +
    dd.value * 0.1 +
    symbolBias;

  const score = clamp(raw, -1, 1);
  const direction = directionFromScore(score);

  const active = drivers.filter((d) => d.weight > 0).length;
  const confidence = clamp(
    0.35 + active * 0.12 + Math.abs(score) * 0.25,
    0.2,
    0.9,
  );

  return {
    symbol: input.symbol,
    assetClass: input.assetClass,
    horizon: input.horizon,
    asOfDate: input.asOfDate,
    score: Number(score.toFixed(4)),
    direction,
    confidence: Number(confidence.toFixed(4)),
    drivers,
    regime: input.regime,
    modelVersion: SIGNAL_MODEL_VERSION,
  };
}
