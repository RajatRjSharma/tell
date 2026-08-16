import type { Client } from "@libsql/client";
import { buildFeatureSnapshot } from "@/lib/features";
import {
  explainUsRegime,
  type RegimeExplainer,
} from "@/lib/features/regime-explain";

/** Latest US regime with beginner-facing explanation cards. */
export async function getRegimeExplainer(
  db: Client,
  options?: { asOf?: string; symbols?: string[] },
): Promise<RegimeExplainer> {
  const snapshot = await buildFeatureSnapshot(db, {
    asOf: options?.asOf,
    symbols: options?.symbols ?? ["SPY", "TLT", "GLD"],
  });
  return explainUsRegime(snapshot.regime, {
    scopeLabel: "United States macro backdrop",
  });
}
