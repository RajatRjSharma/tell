import type { BriefResult, ChatResult, ResearchContext } from "@/lib/ai/types";

export type EvalCheck = {
  id: string;
  pass: boolean;
  detail?: string;
};

export type EvalReport = {
  name: string;
  pass: boolean;
  score: number;
  checks: EvalCheck[];
};

const ADVICE_PATTERNS = [
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\bguaranteed\b/i,
  /\byou should (buy|sell|long|short)\b/i,
  /\ballocate\s+\d+%\b/i,
  /\bposition size\b/i,
];

function hasAdviceLanguage(text: string): boolean {
  return ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

export function evaluateBriefOutput(
  name: string,
  brief: BriefResult,
  context: ResearchContext,
): EvalReport {
  const blob = [brief.title, brief.summary, ...brief.bullets, ...brief.risks]
    .join("\n")
    .toLowerCase();

  const checks: EvalCheck[] = [
    {
      id: "has_title",
      pass: brief.title.trim().length >= 8,
      detail: brief.title,
    },
    {
      id: "has_summary",
      pass: brief.summary.trim().length >= 40,
      detail: `len=${brief.summary.trim().length}`,
    },
    {
      id: "has_bullets",
      pass: brief.bullets.length >= 2,
      detail: `count=${brief.bullets.length}`,
    },
    {
      id: "has_risks",
      pass: brief.risks.length >= 1,
      detail: `count=${brief.risks.length}`,
    },
    {
      id: "has_disclaimer",
      pass: /not financial advice/i.test(brief.disclaimer),
    },
    {
      id: "no_trade_advice",
      pass: !hasAdviceLanguage(blob),
    },
  ];

  if (context.symbol) {
    checks.push({
      id: "mentions_symbol",
      pass: includesAny(blob, [context.symbol]),
      detail: context.symbol,
    });
  }

  if (context.regime) {
    checks.push({
      id: "mentions_regime_or_macro",
      pass: includesAny(blob, [
        context.regime,
        "inflation",
        "regime",
        "macro",
        "rates",
      ]),
      detail: context.regime,
    });
  }

  const directions = [
    ...new Set(context.signals.map((signal) => signal.direction)),
  ];
  if (directions.length > 0) {
    checks.push({
      id: "mentions_direction",
      pass: includesAny(blob, directions),
      detail: directions.join(","),
    });
  }

  const passed = checks.filter((check) => check.pass).length;
  return {
    name,
    pass: checks.every((check) => check.pass),
    score: passed / checks.length,
    checks,
  };
}

export function evaluateChatOutput(
  name: string,
  result: ChatResult,
  context: ResearchContext,
  options?: {
    expectUnknown?: boolean;
    mustMention?: string[];
  },
): EvalReport {
  const answer = result.answer.trim();
  const checks: EvalCheck[] = [
    {
      id: "non_empty",
      pass: answer.length >= 20,
      detail: `len=${answer.length}`,
    },
    {
      id: "has_disclaimer",
      pass: /not financial advice/i.test(result.disclaimer),
    },
    {
      id: "no_trade_advice",
      pass: !hasAdviceLanguage(answer),
    },
    {
      id: "provider_groq",
      pass: result.provider === "groq",
    },
  ];

  if (context.signals.length > 0 || context.macro.length > 0) {
    checks.push({
      id: "has_citations",
      pass: result.citations.length > 0,
      detail: `count=${result.citations.length}`,
    });
  }

  if (options?.mustMention?.length) {
    checks.push({
      id: "mentions_required_tokens",
      pass: includesAny(answer, options.mustMention),
      detail: options.mustMention.join(","),
    });
  }

  if (options?.expectUnknown) {
    checks.push({
      id: "admits_uncertainty",
      pass: includesAny(answer, [
        "unknown",
        "no evidence",
        "not in",
        "do not have",
        "don't have",
        "missing",
        "unavailable",
        "cannot find",
        "no signal",
      ]),
    });
  }

  const passed = checks.filter((check) => check.pass).length;
  return {
    name,
    pass: checks.every((check) => check.pass),
    score: passed / checks.length,
    checks,
  };
}

export function evaluatePromptGrounding(
  name: string,
  prompt: string,
  context: ResearchContext,
): EvalReport {
  const checks: EvalCheck[] = [
    {
      id: "includes_evidence_marker",
      pass: /Evidence/i.test(prompt),
    },
    {
      id: "forbids_advice",
      pass: /Never give trade instructions|Do not give financial advice/i.test(
        prompt,
      ),
    },
  ];

  if (context.symbol) {
    checks.push({
      id: "prompt_includes_symbol",
      pass: prompt.includes(context.symbol),
    });
  }
  if (context.regime) {
    checks.push({
      id: "prompt_includes_regime",
      pass: prompt.includes(context.regime),
    });
  }
  for (const signal of context.signals.slice(0, 2)) {
    checks.push({
      id: `prompt_includes_${signal.symbol}_${signal.horizon}`,
      pass: prompt.includes(signal.symbol) && prompt.includes(signal.direction),
    });
  }

  const passed = checks.filter((check) => check.pass).length;
  return {
    name,
    pass: checks.every((check) => check.pass),
    score: passed / checks.length,
    checks,
  };
}
