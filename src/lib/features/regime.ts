/** US macro regime from a small set of FRED-derived signals. */

export type UsRegime =
  "expansion" | "slowdown" | "inflationary" | "risk_off" | "neutral";

export type UsRegimeInputs = {
  /** CPI YoY pct (e.g. 0.03 = 3%). */
  cpiYoy: number | null;
  /** Industrial production YoY pct. */
  indproYoy: number | null;
  /** Fed funds level (percent). */
  fedFunds: number | null;
  /** 10Y-2Y spread (percent points). */
  curveSpread: number | null;
  /** VIX level. */
  vix: number | null;
};

export type UsRegimeResult = {
  regime: UsRegime;
  asOf: string;
  reasons: string[];
  inputs: UsRegimeInputs;
};

const CPI_HOT = 0.035;
const INDPRO_WEAK = -0.01;
const CURVE_INVERTED = -0.1;
const VIX_STRESS = 25;
const VIX_PANIC = 30;

function pctLabel(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/**
 * Priority (first match wins):
 * 1. risk_off
 * 2. inflationary
 * 3. slowdown
 * 4. expansion
 * 5. neutral
 */
export function classifyUsRegime(
  asOf: string,
  inputs: UsRegimeInputs,
): UsRegimeResult {
  const reasons: string[] = [];
  const { cpiYoy, indproYoy, fedFunds, curveSpread, vix } = inputs;

  if (vix !== null && vix >= VIX_PANIC) {
    reasons.push(`VIX ${vix.toFixed(1)} ≥ ${VIX_PANIC} (stress)`);
    return { regime: "risk_off", asOf, reasons, inputs };
  }

  if (
    vix !== null &&
    vix >= VIX_STRESS &&
    curveSpread !== null &&
    curveSpread < 0
  ) {
    reasons.push(
      `VIX ${vix.toFixed(1)} ≥ ${VIX_STRESS} with inverted curve ${curveSpread.toFixed(2)}`,
    );
    return { regime: "risk_off", asOf, reasons, inputs };
  }

  if (
    cpiYoy !== null &&
    cpiYoy >= CPI_HOT &&
    (indproYoy === null || indproYoy > INDPRO_WEAK)
  ) {
    reasons.push(`CPI YoY ${pctLabel(cpiYoy)} ≥ ${pctLabel(CPI_HOT)}`);
    if (fedFunds !== null) {
      reasons.push(`Fed funds ${fedFunds.toFixed(2)}%`);
    }
    return { regime: "inflationary", asOf, reasons, inputs };
  }

  const weakGrowth = indproYoy !== null && indproYoy <= INDPRO_WEAK;
  const inverted = curveSpread !== null && curveSpread <= CURVE_INVERTED;
  if (weakGrowth || inverted) {
    if (weakGrowth) {
      reasons.push(
        `INDPRO YoY ${pctLabel(indproYoy!)} ≤ ${pctLabel(INDPRO_WEAK)}`,
      );
    }
    if (inverted) {
      reasons.push(`Curve ${curveSpread!.toFixed(2)} ≤ ${CURVE_INVERTED}`);
    }
    return { regime: "slowdown", asOf, reasons, inputs };
  }

  const calm = vix === null || vix < VIX_STRESS;
  const solidGrowth = indproYoy !== null && indproYoy > 0;
  const curveOk = curveSpread === null || curveSpread > CURVE_INVERTED;
  if (calm && solidGrowth && curveOk) {
    reasons.push(`Growth positive (${pctLabel(indproYoy!)} YoY), VIX calm`);
    return { regime: "expansion", asOf, reasons, inputs };
  }

  reasons.push("No strong regime rule matched");
  return { regime: "neutral", asOf, reasons, inputs };
}
