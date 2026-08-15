import type { ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";

export const ECONOMIC_GLOSSARY = {
  cpi: {
    label: "CPI",
    meaning:
      "Consumer Price Index. It tracks how the prices paid by households change over time. A faster rise usually means higher inflation.",
  },
  yieldCurve: {
    label: "Yield curve",
    meaning:
      "The gap between long-term and short-term government interest rates. Here it is the US 10-year rate minus the 2-year rate. A negative number is called an inverted curve and can warn of slower growth.",
  },
  vix: {
    label: "VIX",
    meaning:
      "A measure of how much movement investors expect from the US stock market over the next 30 days. A higher VIX usually means more fear or uncertainty.",
  },
  regime: {
    label: "Market regime",
    meaning:
      "The broad economic backdrop, such as expansion, slowdown, high inflation, or risk-off stress. Tell uses it as one input when scoring assets.",
  },
  riskOn: {
    label: "Risk-on",
    meaning:
      "Investors are generally more willing to own growth-sensitive assets such as stocks.",
  },
  mixed: {
    label: "Mixed",
    meaning:
      "The signals disagree or are too weak to show a clear positive or negative direction.",
  },
  riskOff: {
    label: "Risk-off",
    meaning:
      "Investors are generally more defensive and may prefer cash, government bonds, or other safer assets.",
  },
  bullish: {
    label: "Bullish",
    meaning:
      "The model sees more evidence for the asset price to rise than to fall over the selected time period.",
  },
  neutral: {
    label: "Neutral",
    meaning:
      "The model does not see a strong enough case for either a rise or a fall.",
  },
  bearish: {
    label: "Bearish",
    meaning:
      "The model sees more evidence for the asset price to fall than to rise over the selected time period.",
  },
  signalScore: {
    label: "Signal score",
    meaning:
      "A number from -1 to +1. Positive favors a rise and negative favors a fall. Tell combines market regime, recent price momentum, volatility, drawdown, and a few asset-specific rules. Scores from -0.15 to +0.15 are neutral.",
  },
  confidence: {
    label: "Confidence",
    meaning:
      "How much usable evidence supports the signal. It rises when more model inputs are available and when the score is farther from neutral. It is not the probability of being correct.",
  },
  hitRate: {
    label: "Hit rate",
    meaning:
      "The share of completed past forecasts whose direction matched what the price later did. For example, 6/10 means six of ten forecasts were correct.",
  },
  evaluated: {
    label: "Evaluated",
    meaning:
      "Past forecasts whose full time period has finished, so their result can be checked.",
  },
  horizon: {
    label: "Time horizon",
    meaning:
      "How far ahead the forecast looks: 1d is 1 market day, 1w is about 5 market days, and 1m is about 21 market days.",
  },
  momentum: {
    label: "Momentum",
    meaning:
      "Whether the asset price has recently been moving up or down. Tell uses a period that matches the selected forecast horizon.",
  },
  volatility: {
    label: "Volatility",
    meaning:
      "How sharply and unpredictably a price moves. Higher volatility means larger swings and usually lowers the model's outlook.",
  },
  drawdown: {
    label: "Drawdown",
    meaning:
      "How far an asset has fallen from a recent high. A deeper drawdown can be a warning that price conditions are weak.",
  },
  equities: {
    label: "Equities",
    meaning: "Shares of companies, commonly called stocks.",
  },
  fx: {
    label: "FX",
    meaning:
      "Foreign exchange: the value of one currency compared with another, such as EUR/USD.",
  },
  commodities: {
    label: "Commodities",
    meaning:
      "Tradable raw materials such as gold, crude oil, wheat, or copper.",
  },
  rates: {
    label: "Rates",
    meaning:
      "Interest-rate markets, especially government bonds. Bond prices usually move opposite to bond yields.",
  },
  hawkish: {
    label: "Hawkish",
    meaning:
      "Central-bank language that leans toward higher interest rates to control inflation.",
  },
  dovish: {
    label: "Dovish",
    meaning:
      "Central-bank language that leans toward lower interest rates to support growth or jobs.",
  },
  median: {
    label: "Median",
    meaning:
      "The middle result after sorting all results. It is less distorted by one unusually large gain or loss than an average.",
  },
  sessions: {
    label: "Market sessions",
    meaning:
      "Trading days when the market was open. Weekends and market holidays are not counted.",
  },
  forwardReturn: {
    label: "Forward return",
    meaning:
      "The price change measured after an event, over the stated time period.",
  },
} as const;

export type EconomicTermKey = keyof typeof ECONOMIC_GLOSSARY;

export function EconomicTerm({
  term,
  children,
  className = "",
}: {
  term: EconomicTermKey;
  children?: ReactNode;
  className?: string;
}) {
  const entry = ECONOMIC_GLOSSARY[term];

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 ${className}`.trim()}
    >
      <span className="min-w-0">{children ?? entry.label}</span>
      <InfoTip label={entry.label}>{entry.meaning}</InfoTip>
    </span>
  );
}
