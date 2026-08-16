import type {
  UsRegime,
  UsRegimeInputs,
  UsRegimeResult,
} from "@/lib/features/regime";

export type RegimePlainLabel =
  | "Expansion"
  | "Slowdown"
  | "Inflation pressure"
  | "Risk-off stress"
  | "Neutral / unclear";

export type RegimeInputCard = {
  id: string;
  label: string;
  valueLabel: string;
  thresholdLabel: string;
  status: "ok" | "watch" | "stress" | "missing";
  note: string;
};

export type RegimeExplainer = {
  regime: UsRegime;
  plainLabel: RegimePlainLabel;
  meaning: string;
  scopeLabel: string;
  asOf: string;
  reasons: string[];
  inputs: RegimeInputCard[];
  assetClassHints: string[];
  possibleValues: Array<{
    id: UsRegime;
    label: RegimePlainLabel;
    when: string;
  }>;
  disclaimer: string;
};

const CPI_HOT = 0.035;
const INDPRO_WEAK = -0.01;
const CURVE_INVERTED = -0.1;
const VIX_STRESS = 25;
const VIX_PANIC = 30;

export function plainRegimeLabel(regime: UsRegime): RegimePlainLabel {
  switch (regime) {
    case "expansion":
      return "Expansion";
    case "slowdown":
      return "Slowdown";
    case "inflationary":
      return "Inflation pressure";
    case "risk_off":
      return "Risk-off stress";
    default:
      return "Neutral / unclear";
  }
}

function pct(rate: number | null, digits = 1): string {
  if (rate == null || !Number.isFinite(rate)) return "n/a";
  return `${(rate * 100).toFixed(digits)}%`;
}

function meaningFor(regime: UsRegime): string {
  switch (regime) {
    case "expansion":
      return "Growth looks steady and market stress looks contained. That is usually friendlier for risk assets, though not a guarantee.";
    case "slowdown":
      return "Growth is soft and/or the yield curve is inverted. That often means caution for equities and more interest in safer bonds.";
    case "inflationary":
      return "Consumer prices are rising quickly while production is not collapsing. Hot inflation often pressures long bonds and can support some commodities.";
    case "risk_off":
      return "Volatility is elevated. Investors often prefer safer assets until stress cools.";
    default:
      return "No single regime rule dominates. Treat the backdrop as mixed and look at asset-level evidence.";
  }
}

function hintsFor(regime: UsRegime): string[] {
  switch (regime) {
    case "expansion":
      return [
        "Equities: usually constructive",
        "Long bonds: mildly pressured",
        "Commodities: mild demand support",
      ];
    case "slowdown":
      return [
        "Equities: usually cautious",
        "Long bonds: often supported",
        "Commodities: demand can soften",
      ];
    case "inflationary":
      return [
        "Equities: mixed",
        "Long bonds: usually pressured",
        "Commodities: often more supported",
      ];
    case "risk_off":
      return [
        "Equities: usually pressured",
        "Long bonds: flight-to-quality support",
        "USD: can firm in stress",
      ];
    default:
      return [
        "Equities: no clear regime tilt",
        "Bonds and FX: read asset-level signals",
        "Commodities: wait for clearer evidence",
      ];
  }
}

function inputCards(inputs: UsRegimeInputs): RegimeInputCard[] {
  const cpi = inputs.cpiYoy;
  const indpro = inputs.indproYoy;
  const curve = inputs.curveSpread;
  const vix = inputs.vix;
  const fed = inputs.fedFunds;

  return [
    {
      id: "cpiYoy",
      label: "US CPI inflation (YoY)",
      valueLabel: pct(cpi),
      thresholdLabel: `Hot if ≥ ${pct(CPI_HOT)}`,
      status: cpi == null ? "missing" : cpi >= CPI_HOT ? "stress" : "ok",
      note: "Year-over-year change in consumer prices. This is what the regime uses — not the CPI index level.",
    },
    {
      id: "indproYoy",
      label: "US industrial production (YoY)",
      valueLabel: pct(indpro),
      thresholdLabel: `Weak if ≤ ${pct(INDPRO_WEAK)}`,
      status:
        indpro == null ? "missing" : indpro <= INDPRO_WEAK ? "watch" : "ok",
      note: "Factory and production activity versus a year ago.",
    },
    {
      id: "curve",
      label: "US 10Y−2Y yield curve",
      valueLabel:
        curve == null || !Number.isFinite(curve)
          ? "n/a"
          : `${curve >= 0 ? "+" : ""}${curve.toFixed(2)} pp`,
      thresholdLabel: `Inverted caution if ≤ ${CURVE_INVERTED}`,
      status:
        curve == null ? "missing" : curve <= CURVE_INVERTED ? "watch" : "ok",
      note: "Long-term minus short-term Treasury yields. Negative can warn of slower growth.",
    },
    {
      id: "vix",
      label: "VIX fear gauge",
      valueLabel: vix == null || !Number.isFinite(vix) ? "n/a" : vix.toFixed(1),
      thresholdLabel: `Stress ≥ ${VIX_STRESS} · Panic ≥ ${VIX_PANIC}`,
      status:
        vix == null
          ? "missing"
          : vix >= VIX_PANIC
            ? "stress"
            : vix >= VIX_STRESS
              ? "watch"
              : "ok",
      note: "Expected US equity volatility over about 30 days.",
    },
    {
      id: "fedfunds",
      label: "Fed funds rate",
      valueLabel:
        fed == null || !Number.isFinite(fed) ? "n/a" : `${fed.toFixed(2)}%`,
      thresholdLabel: "Context only (not a hard trigger)",
      status: fed == null ? "missing" : "ok",
      note: "Policy interest rate. Shown for context when inflation is hot.",
    },
  ];
}

/** Beginner-facing explanation of a US regime classification. */
export function explainUsRegime(
  result: UsRegimeResult,
  options?: { scopeLabel?: string },
): RegimeExplainer {
  return {
    regime: result.regime,
    plainLabel: plainRegimeLabel(result.regime),
    meaning: meaningFor(result.regime),
    scopeLabel: options?.scopeLabel ?? "United States macro backdrop",
    asOf: result.asOf,
    reasons:
      result.reasons.length > 0
        ? result.reasons
        : ["No strong regime rule matched"],
    inputs: inputCards(result.inputs),
    assetClassHints: hintsFor(result.regime),
    possibleValues: [
      {
        id: "risk_off",
        label: "Risk-off stress",
        when: `VIX ≥ ${VIX_PANIC}, or VIX ≥ ${VIX_STRESS} with an inverted curve`,
      },
      {
        id: "inflationary",
        label: "Inflation pressure",
        when: `CPI YoY ≥ ${pct(CPI_HOT)} and production is not collapsing`,
      },
      {
        id: "slowdown",
        label: "Slowdown",
        when: `Industrial production YoY ≤ ${pct(INDPRO_WEAK)} or curve ≤ ${CURVE_INVERTED}`,
      },
      {
        id: "expansion",
        label: "Expansion",
        when: "Positive production growth, calm VIX, and a non-inverted curve",
      },
      {
        id: "neutral",
        label: "Neutral / unclear",
        when: "No single rule dominates",
      },
    ],
    disclaimer:
      "This is a current-condition label from US macro series, not a future price prediction. Non-US assets still inherit this US backdrop in rules-v1.",
  };
}
