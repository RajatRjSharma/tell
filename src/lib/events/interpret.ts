export function typicalEventImpact(
  sentiment: number | null,
  source: string | null,
): string {
  const currency =
    source === "ECB"
      ? "the euro"
      : source === "BoE"
        ? "sterling"
        : source === "Fed"
          ? "the US dollar"
          : "the local currency";

  if (sentiment != null && sentiment > 0.1) {
    return `Typical sensitivity: a tighter-rate tone can pressure bonds and rate-sensitive equities, while ${currency} may strengthen.`;
  }
  if (sentiment != null && sentiment < -0.1) {
    return `Typical sensitivity: an easier-rate tone can support bonds and rate-sensitive equities, while ${currency} may weaken.`;
  }
  return "Typical sensitivity: the headline tone is mixed or unclassified, so direction depends on the details and what markets expected.";
}
