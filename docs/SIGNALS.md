# Signal methodology

Every outlook is produced by deterministic rules stamped with model version `rules-v1`. The same inputs always yield the same score, and each score carries the drivers that produced it.

## Pipeline

```text
readings + asset_readings
        -> macro features (level, change, z-score)
        -> market features (returns, volatility, drawdown)
        -> US regime classification
        -> scoreSignal per symbol and horizon
        -> signals table
        -> forecast_log grading once forward bars exist
```

## Input universe

Macro series used for features and regime detection: `CPI`, `INDPRO`, `FEDFUNDS`, `T10Y2Y`, `DGS10`, `DGS2`.

Volatility input tries `VIXCLS` first, then `VIX`; if neither has data, the cache stores an empty `VIX` series.

Default market symbols for a feature snapshot: `SPY`, `TLT`, `GLD`.

All feature loading filters `vintage = 'current'`, so ALFRED revision history never leaks into live scoring.

## Macro features

For each series, values are taken as of the scoring date, never later.

| Field | Definition |
| ----- | ---------- |
| `level` | Latest observation dated on or before the as-of date |
| `observedFor` | That observation's date |
| `changeLag` | `(latest - prior) / abs(prior)` where `prior` is a fixed number of observations earlier |
| `zScore` | `(latest - mean(window)) / sampleStdev(window)` |

Lag and window depend on frequency:

| Series group | `changeLags` | `zLookback` |
| ------------ | ------------ | ----------- |
| Daily series: `DGS10`, `DGS2`, `T10Y2Y`, `VIX`, `VIXCLS`, `DTWEXBGS`, any ID containing `VIX` | 21 | 252 |
| Everything else, including monthly and quarterly | 12 | 36 |

Notes:

- Changes are computed over observation counts, not calendar spacing.
- Sample standard deviation uses `n - 1`.
- A z-score requires at least 3 trailing points and nonzero variance, otherwise it is null.
- Percent change rejects non-finite values and a zero base.

Regime inputs are derived from these series: `cpiYoy` and `indproYoy` are 12-observation changes, while `fedFunds`, `curveSpread`, and `vix` are latest levels.

## Market features

| Field | Definition |
| ----- | ---------- |
| `close` | Latest close on or before the as-of date |
| `return1d` | Change over 1 observation |
| `return5d` | Change over 5 observations |
| `return21d` | Change over 21 observations |
| `vol21d` | Sample standard deviation of the trailing 21 daily returns, annualized by the square root of 252, requiring 22 closes |
| `drawdown63d` | `(latest - max(last 63 closes)) / max(last 63 closes)` |

## Regime classification

Constants in `src/lib/features/regime.ts`:

| Constant | Value |
| -------- | ----- |
| `CPI_HOT` | 0.035 |
| `INDPRO_WEAK` | -0.01 |
| `CURVE_INVERTED` | -0.1 |
| `VIX_STRESS` | 25 |
| `VIX_PANIC` | 30 |

Rules are evaluated in order and the first match wins:

1. **`risk_off`** when `vix >= VIX_PANIC`.
2. **`risk_off`** when `vix >= VIX_STRESS` and `curveSpread < 0`. This second test uses zero, not `CURVE_INVERTED`.
3. **`inflationary`** when `cpiYoy >= CPI_HOT` and industrial production is either unknown or above `INDPRO_WEAK`.
4. **`slowdown`** when `indproYoy <= INDPRO_WEAK`, or `curveSpread <= CURVE_INVERTED`.
5. **`expansion`** when volatility is unknown or below `VIX_STRESS`, `indproYoy > 0`, and the curve is unknown or above `CURVE_INVERTED`.
6. **`neutral`** otherwise.

`fedFunds` never selects a regime; it only appears in the explanation for the inflationary case. Each classification returns human-readable reasons that surface as dashboard evidence.

## Score composition

```text
raw = 0.40 * regimeBias
    + momentumWeight * momentumValue
    + 0.15 * volatilityValue
    + 0.10 * drawdownValue
    + symbolBias

score = clamp(raw, -1, 1)   // stored with 4 decimals
```

### Regime bias by asset class

| Regime | equity | rates | commodity | fx | other |
| ------ | ------ | ----- | --------- | -- | ----- |
| `risk_off` | -0.55 | 0.35 | 0.15 | -0.15 | -0.20 |
| `inflationary` | -0.10 | -0.45 | 0.30 | 0.10 | 0 |
| `slowdown` | -0.35 | 0.25 | -0.20 | -0.10 | -0.10 |
| `expansion` | 0.40 | -0.15 | 0.15 | 0.10 | 0.10 |
| `neutral` | 0 | 0 | 0 | 0 | 0 |

The regime driver is always recorded with weight 0.40, even when the bias is zero.

### Momentum

| Horizon bars | Field | Scale | Weight |
| ------------ | ----- | ----- | ------ |
| 2 or fewer | `return1d` | 0.03 | 0.45 |
| 3 to 10 | `return5d` | 0.06 | 0.45 |
| More than 10 | `return21d` | 0.10 | 0.45 |

The scaled value is clamped to the range -1 to 1. When the return is unavailable, both value and weight are zero and no momentum driver is recorded.

### Volatility and drawdown

| Condition | Value | Multiplier |
| --------- | ----- | ---------- |
| `vol21d >= 0.35` | -0.25 | 0.15 |
| `vol21d >= 0.25` | -0.10 | 0.15 |
| `drawdown63d <= -0.10` | -0.20 | 0.10 |
| `drawdown63d <= -0.05` | -0.10 | 0.10 |

These drivers are recorded only when nonzero.

### Symbol adjustments

| Symbol | Regime | Bias | Driver |
| ------ | ------ | ---- | ------ |
| `GLD` | `inflationary` or `risk_off` | +0.15 | `gold_hedge`, displayed weight 0.10 |
| `TLT` | `inflationary` | -0.10 | none |
| `USO` | `slowdown` | -0.10 | none |

Symbol bias is added directly to the raw score without a further multiplier.

### Direction and confidence

| Score | Direction |
| ----- | --------- |
| 0.15 or above | `bullish` |
| -0.15 or below | `bearish` |
| Between | `neutral` |

```text
active     = number of recorded drivers with weight > 0
confidence = clamp(0.35 + 0.12 * active + 0.25 * abs(score), 0.2, 0.9)
```

Confidence is stored with 4 decimals. Because the regime driver always counts, realistic confidence starts near 0.47 and grows with driver agreement and score magnitude.

## Horizons

| Token | Trading bars |
| ----- | ------------ |
| `1d` | 1 |
| `1w` | 5 |
| `2w` | 10 |
| `1m` | 21 |
| `3m` | 63 |
| `6m` | 126 |
| `1y` | 252 |

Custom tokens must match `Nd` with an integer from 1 to 504. Weeks and months exist only as the presets above. Token lists are trimmed, lowercased, de-duplicated in first-seen order, and fall back to `1d,1w,1m` when empty.

## Forecast evaluation

Forward return anchors on the last close dated on or before the signal date and ends exactly `horizonBars` observations later:

```text
actualReturn = (close[end] - close[start]) / abs(close[start])
```

The return is null when the horizon is not positive, no starting close exists, the future close has not printed yet, or the starting close is zero or non-finite.

Neutral tolerance widens with horizon length:

```text
neutralBand = 0.002 * sqrt(max(bars, 1))
```

| Horizon | Band |
| ------- | ---- |
| 1 bar | 0.20% |
| 5 bars | about 0.45% |
| 21 bars | about 0.92% |

Grading:

- `bullish` is correct when the return is strictly positive.
- `bearish` is correct when the return is strictly negative.
- `neutral` is correct when the absolute return is within the band.

Quality aggregation counts only rows with both a return and a correctness flag, and reports `n`, `hits`, `hitRate`, `avgReturnWhenBullish`, and `avgReturnWhenBearish`. Evaluation loads up to 5,000 unevaluated signals per run; quality reports read at most 2,000 forecast rows.

Because a fresh install has no history, run `make backfill-signals` to rebuild past signals and grade them before trusting hit rates.

## Near-term risk bias

Source: `src/lib/risk/near-term.ts`. The panel answers "what does today's ensemble lean toward, and what carries into tomorrow".

1. Find the latest `as_of_date` among `1d` signals for the model version.
2. Count directions and average the scores for that date, treating missing scores as zero.
3. `tomorrowScore = todayScore * 0.65`.

| Score | Label |
| ----- | ----- |
| 0.15 or above | `risk-on` |
| -0.15 or below | `risk-off` |
| Between | `mixed` |

Scores are rounded to three decimals. With no signals, both scores are zero, both labels are `mixed`, and `sampleSize` is zero. Tomorrow is explicitly a dampened carry-forward, not a separate model.

## Event impact studies

Source: `src/lib/events/impact.ts`. For each matching event, asset, and horizon the study anchors on the last close dated on or before the event date, takes the close `bars` observations later, and computes the same forward-return formula.

Summary statistics per symbol and horizon: `n`, `mean`, `median` (average of the two middle values for even samples), and `hitRateUp`, which counts strictly positive returns only.

Sentiment buckets from the stored keyword tone:

| Sentiment | Bucket |
| --------- | ------ |
| Above 0.1 | `hawkish` |
| Below -0.1 | `dovish` |
| Otherwise, including null | `neutral` |

Default asset mapping per source:

| Source | Assets |
| ------ | ------ |
| `Fed` | `SPY`, `TLT`, `GLD`, `USDJPY`, `MCHI` |
| `ECB` | `EWG`, `EURUSD`, `TLT`, `GLD` |
| `BoE` | `EWU`, `GBPUSD`, `TLT`, `GLD` |

Defaults: source falls back to the symbol's first mapped source, otherwise `Fed`; horizons default to `1d,1w,1m`; sentiment defaults to `any`; the event sample defaults to 120 and is clamped between 1 and 300. No event-type restriction is applied.

## Macro sparkline strip

Source: `src/lib/macro/strip.ts` and `sparklines.ts`. Three US series render above the dashboard:

| ID | Label | Unit | Fallback |
| -- | ----- | ---- | -------- |
| `CPI` | CPI | index | none |
| `T10Y2Y` | Curve | percent | none |
| `VIXCLS` | VIX | level | `VIX` |

The point limit defaults to 24 and is clamped between 6 and 120, so very small requests still return 6 points. Readings are reversed into chronological order. `change` is the absolute difference from the previous point, `rangeChange` the difference from the first loaded point; neither is a percentage. Each sparkline normalizes its own min and max into the drawing box with 2px padding, and a single point renders as a centered horizontal line.

## Script configuration

| Script | Variables |
| ------ | --------- |
| `compute-features` | `FEATURE_SYMBOLS` default `SPY,TLT,GLD,EURUSD`; `FEATURE_AS_OF` defaults to the latest date for the first symbol, then today in UTC |
| `compute-signals` | `SIGNAL_HORIZONS` default `1d,1w,1m`; `SIGNAL_AS_OF` defaults to the latest market date; `LIVE_QUOTE_SYMBOLS` default `SPY,GLD,TLT`; optional `FINNHUB_API_KEY` |
| `compute-forecasts` | `SIGNAL_HORIZONS` default `1d,1w,1m`; `FORECAST_SYMBOLS` unset means all symbols |
| `backfill-signals` | `BACKFILL_DAYS` default 90, capped at 2000; `BACKFILL_FROM`, `BACKFILL_TO`; `FORECAST_SYMBOLS`; `BACKFILL_SKIP_FORECASTS=1` |

Live quotes printed by `compute-signals` are context only and never enter a score.

## Documented limits

- Daily bars only; there are no intraday signals.
- Rule weights are hand-set, not fitted, which keeps them explainable but not optimal.
- RSS coverage and keyword tone are narrower than a full economic calendar.
- Hit rates need backfilled history before they are meaningful.
- ALFRED vintages are stored for revision research; live features still read the current vintage.
