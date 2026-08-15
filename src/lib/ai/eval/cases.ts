import { buildBriefPrompt, parseBriefJson } from "@/lib/ai/brief";
import {
  emptyContext,
  marketOverviewContext,
  spyNeutralContext,
  tltBearishContext,
} from "@/lib/ai/eval/fixtures";
import {
  evaluateBriefOutput,
  evaluateChatOutput,
  evaluatePromptGrounding,
  type EvalReport,
} from "@/lib/ai/eval/rubric";
import type { BriefResult, ChatResult, ResearchContext } from "@/lib/ai/types";

export type BriefEvalCase = {
  id: string;
  context: ResearchContext;
  modelText: string;
};

export type ChatEvalCase = {
  id: string;
  context: ResearchContext;
  question: string;
  modelText: string;
  expectUnknown?: boolean;
  mustMention?: string[];
};

export const BRIEF_EVAL_CASES: BriefEvalCase[] = [
  {
    id: "spy-neutral-structured",
    context: spyNeutralContext,
    modelText: JSON.stringify({
      title: "SPY stays neutral under inflationary pressure",
      summary:
        "SPY is neutral on the 1d horizon as an inflationary regime creates mixed equity conditions. Momentum is mildly negative and confidence sits near 61%.",
      bullets: [
        "Direction is neutral with score -0.07.",
        "Regime evidence says inflation is mixed for equities.",
        "1d momentum print is -0.20%.",
        "Policy rate remains elevated in the latest FEDFUNDS reading.",
      ],
      risks: [
        "A sharper inflation surprise could reprice equities quickly.",
        "Signal confidence is moderate, so the view can flip with new data.",
      ],
    }),
  },
  {
    id: "tlt-bearish-structured",
    context: tltBearishContext,
    modelText: JSON.stringify({
      title: "TLT remains bearish as inflation pressures duration",
      summary:
        "TLT is bearish on the 1w horizon. An inflationary regime and firm 10-year yields continue to pressure long-duration Treasuries.",
      bullets: [
        "Direction is bearish with score -0.36.",
        "Drivers cite higher-rate pressure on long duration.",
        "Weekly momentum is negative at about -1.10%.",
      ],
      risks: [
        "A sudden growth scare could rally long bonds.",
        "Yields can reverse quickly around policy communication.",
      ],
    }),
  },
  {
    id: "market-overview-structured",
    context: marketOverviewContext,
    modelText: JSON.stringify({
      title: "Cross-asset split: gold bid, duration soft",
      summary:
        "Under an inflationary regime, gold looks bullish while long Treasuries stay bearish. The tape is split rather than one-sided risk-on.",
      bullets: [
        "GLD is bullish on the 1d horizon.",
        "TLT is bearish as higher rates pressure duration.",
        "CPI remains the key macro anchor in the evidence set.",
      ],
      risks: [
        "Commodity strength can fade if inflation cools.",
        "Rates volatility can dominate equity-adjacent assets.",
      ],
    }),
  },
];

export const CHAT_EVAL_CASES: ChatEvalCase[] = [
  {
    id: "why-spy-neutral",
    context: spyNeutralContext,
    question: "Why is SPY neutral on 1d?",
    modelText:
      "SPY is neutral on the 1d horizon because the inflationary regime is mixed for equities and 1d momentum is slightly negative at -0.20%.",
    mustMention: ["SPY", "neutral", "inflation"],
  },
  {
    id: "why-tlt-bearish",
    context: tltBearishContext,
    question: "Why is TLT bearish?",
    modelText:
      "TLT is bearish because the inflationary regime pressures long duration and the 1w signal score is -0.36 with negative momentum.",
    mustMention: ["TLT", "bearish"],
  },
  {
    id: "missing-symbol-unknown",
    context: emptyContext,
    question: "What is the outlook for ZZZ?",
    modelText:
      "I do not have signal evidence for ZZZ in the current evidence block, so the outlook is unknown from Tell's latest data.",
    expectUnknown: true,
    mustMention: ["ZZZ"],
  },
];

export function runBriefEvalCase(evalCase: BriefEvalCase): EvalReport[] {
  const prompt = buildBriefPrompt(evalCase.context);
  const brief: BriefResult = parseBriefJson(evalCase.modelText, {
    model: "eval-mock",
    asOf: evalCase.context.asOf,
    symbol: evalCase.context.symbol,
    horizon: evalCase.context.horizon,
    cached: false,
  });

  return [
    evaluatePromptGrounding(`${evalCase.id}:prompt`, prompt, evalCase.context),
    evaluateBriefOutput(`${evalCase.id}:output`, brief, evalCase.context),
  ];
}

export function runChatEvalCase(evalCase: ChatEvalCase): EvalReport {
  const result: ChatResult = {
    answer: evalCase.modelText,
    model: "eval-mock",
    provider: "groq",
    citations:
      evalCase.context.signals.length || evalCase.context.macro.length
        ? [
            evalCase.context.regime
              ? `regime:${evalCase.context.regime}`
              : "signals",
          ]
        : [],
    disclaimer:
      "Research aid only. Not financial advice or a guaranteed prediction.",
  };

  return evaluateChatOutput(`${evalCase.id}:output`, result, evalCase.context, {
    expectUnknown: evalCase.expectUnknown,
    mustMention: evalCase.mustMention,
  });
}

export function summarizeReports(reports: EvalReport[]): {
  pass: boolean;
  averageScore: number;
  failed: string[];
} {
  const averageScore =
    reports.reduce((sum, report) => sum + report.score, 0) /
    Math.max(reports.length, 1);
  const failed = reports
    .filter((report) => !report.pass)
    .flatMap((report) =>
      report.checks
        .filter((check) => !check.pass)
        .map((check) => `${report.name}:${check.id}`),
    );

  return {
    pass: reports.every((report) => report.pass),
    averageScore,
    failed,
  };
}
