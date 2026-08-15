import { drawdownFromHigh, realizedVol, simpleReturn } from "./returns";
import { indexAtOrBefore, type SeriesPoint } from "./series";

export type MarketFeatures = {
  symbol: string;
  asOf: string;
  close: number | null;
  return1d: number | null;
  return5d: number | null;
  return21d: number | null;
  vol21d: number | null;
  drawdown63d: number | null;
};

export function computeMarketFeatures(
  symbol: string,
  closes: SeriesPoint[],
  asOf: string,
): MarketFeatures {
  const point = indexAtOrBefore(closes, asOf);
  return {
    symbol,
    asOf,
    close: point >= 0 ? closes[point]!.value : null,
    return1d: simpleReturn(closes, asOf, 1),
    return5d: simpleReturn(closes, asOf, 5),
    return21d: simpleReturn(closes, asOf, 21),
    vol21d: realizedVol(closes, asOf, 21),
    drawdown63d: drawdownFromHigh(closes, asOf, 63),
  };
}
