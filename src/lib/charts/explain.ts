/** One-line, plain-language reading of a macro value. Thresholds are conventional rules of thumb. */
export function explainMacroValue(
  id: string,
  value: number,
  previous: number | null = null,
): string {
  if (id === "VIXCLS" || id === "VIX") {
    if (value < 15) return "Calm: markets expect small moves.";
    if (value < 20) return "Normal: typical day-to-day swings.";
    if (value < 30) return "Elevated: investors are paying up for protection.";
    return "Stress: markets expect large moves.";
  }

  if (id === "T10Y2Y") {
    if (value < 0) {
      return "Inverted: short rates above long rates, a classic recession warning.";
    }
    if (value < 0.5) return "Flat: little reward for lending longer.";
    return "Normal: long rates comfortably above short rates.";
  }

  if (id === "CPI") {
    if (previous == null || previous === 0) return "Price level index.";
    const mom = ((value - previous) / previous) * 100;
    const sign = mom >= 0 ? "+" : "";
    return `Prices ${sign}${mom.toFixed(2)}% vs the prior month.`;
  }

  if (id === "CPI_YOY_M") {
    if (value < 0) return "Deflation: prices falling year on year.";
    if (value < 1) return "Very low inflation.";
    if (value <= 3) return "Near most central bank targets (~2%).";
    if (value <= 6) return "Above target: pressure to keep rates high.";
    return "High inflation.";
  }

  if (id === "POLICY_RATE") {
    if (previous == null) return "Central bank policy rate.";
    const diff = value - previous;
    if (Math.abs(diff) < 0.005) return "Unchanged from the prior month.";
    return diff > 0
      ? `Hiked ${diff.toFixed(2)} pp vs the prior month.`
      : `Cut ${Math.abs(diff).toFixed(2)} pp vs the prior month.`;
  }

  return "";
}

/** Signed percent with two decimals: 0.0342 → "+3.42%". */
export function formatSignedPct(ratio: number): string {
  return `${ratio >= 0 ? "+" : "−"}${Math.abs(ratio * 100).toFixed(2)}%`;
}
