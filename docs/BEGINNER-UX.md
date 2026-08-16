# Beginner decision UX

Tell’s home page is optimized for non-economists. Technical detail remains available, but the first screen answers: what may happen, where, when, why, how strong the evidence is, and what could change it.

## Honesty contracts

| Concept | Meaning in Tell |
| ------- | ---------------- |
| Current condition | US regime label from CPI YoY, industrial production, curve, VIX, Fed funds |
| Research lean | Directional score from rules-v1 for a horizon |
| Evidence strength | Completeness / decisiveness heuristic (not P(correct)) |
| Next session bias | Average of latest 1d scores across the loaded universe |
| Softer follow-on | 65% carry of that average — not an independent tomorrow model |
| Historical analogue | Forward returns after similar policy headlines |
| Live quote | Optional overlay; not the scored signal |

## Horizon language

Trading sessions, not calendar days:

- Next session ≈ 1 trading day (`1d`)
- ~1 week ≈ 5 sessions (`1w`)
- ~1 month ≈ 21 sessions (`1m`)

Longer horizons (`3m` / `6m` / `1y`) exist in the scoring library but are not productized until longer-horizon features and backtests pass quality gates.

## Scope

- Decision summary follows the current market filter (world / watchlist / asset class).
- Signal quality defaults to all graded assets; users can switch to the selected asset.
- Policy events request the selected symbol and country without silently falling back to an unscoped feed.
- Regime explanation is still US-backed in rules-v1; non-US assets inherit that backdrop until country regimes ship.

## Key modules

- `src/lib/decision/summary.ts` — 5W1H builder
- `src/lib/decision/horizons.ts` — plain horizon labels
- `src/lib/features/regime-explain.ts` — beginner regime cards
- `src/components/DecisionSummaryPanel.tsx`
- `src/components/RegimeExplainerPanel.tsx`
- `GET /api/regime`
