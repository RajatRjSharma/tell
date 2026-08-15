import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateBrief } from "@/lib/ai/brief";
import { answerResearchQuestion } from "@/lib/ai/chat";
import { cacheClear } from "@/lib/ai/cache";
import {
  BRIEF_EVAL_CASES,
  CHAT_EVAL_CASES,
  runBriefEvalCase,
  runChatEvalCase,
  summarizeReports,
} from "@/lib/ai/eval/cases";
import { spyNeutralContext } from "@/lib/ai/eval/fixtures";
import { evaluateBriefOutput, evaluateChatOutput } from "@/lib/ai/eval/rubric";
import { parseBriefJson } from "@/lib/ai/brief";
import { AI_DISCLAIMER } from "@/lib/ai/types";

vi.mock("@/lib/ai/context", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ai/context")>(
      "@/lib/ai/context",
    );
  return {
    ...actual,
    buildResearchContext: vi.fn(async () => spyNeutralContext),
  };
});

vi.mock("@/lib/ai/store", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ai/store")>("@/lib/ai/store");
  return {
    ...actual,
    getLatestResearchBrief: vi.fn(async () => null),
    listResearchBriefs: vi.fn(async () => []),
    upsertResearchBrief: vi.fn(async () => undefined),
  };
});

describe("AI offline eval suite", () => {
  it("passes all brief eval cases", () => {
    const reports = BRIEF_EVAL_CASES.flatMap((evalCase) =>
      runBriefEvalCase(evalCase),
    );
    const summary = summarizeReports(reports);
    expect(summary.failed).toEqual([]);
    expect(summary.pass).toBe(true);
    expect(summary.averageScore).toBeGreaterThan(0.95);
  });

  it("passes all chat eval cases", () => {
    const reports = CHAT_EVAL_CASES.map((evalCase) =>
      runChatEvalCase(evalCase),
    );
    const summary = summarizeReports(reports);
    expect(summary.failed).toEqual([]);
    expect(summary.pass).toBe(true);
  });

  it("fails briefs that give trade advice", () => {
    const brief = parseBriefJson(
      JSON.stringify({
        title: "SPY buy now brief",
        summary:
          "You should buy SPY immediately for a guaranteed gain under this inflation regime.",
        bullets: ["Buy now", "Allocate 40%"],
        risks: ["None"],
      }),
      {
        model: "eval-mock",
        asOf: "2026-08-14",
        symbol: "SPY",
        horizon: "1d",
        cached: false,
      },
    );

    const report = evaluateBriefOutput(
      "advice-should-fail",
      brief,
      spyNeutralContext,
    );
    expect(report.pass).toBe(false);
    expect(
      report.checks.find((check) => check.id === "no_trade_advice")?.pass,
    ).toBe(false);
  });

  it("fails chat answers that omit required tokens", () => {
    const report = evaluateChatOutput(
      "missing-token",
      {
        answer: "Markets are mixed today with no clear catalyst.",
        model: "eval-mock",
        provider: "groq",
        citations: ["regime:inflationary"],
        disclaimer: AI_DISCLAIMER,
      },
      spyNeutralContext,
      { mustMention: ["SPY", "neutral"] },
    );

    expect(report.pass).toBe(false);
    expect(
      report.checks.find((check) => check.id === "mentions_required_tokens")
        ?.pass,
    ).toBe(false);
  });
});

describe("AI pipeline eval with mocked providers", () => {
  beforeEach(() => {
    cacheClear();
  });

  it("generateBrief stays within rubric on fixture context", async () => {
    const modelText = BRIEF_EVAL_CASES[0]!.modelText;
    const brief = await generateBrief({} as never, {
      symbol: "SPY",
      horizon: "1d",
      refresh: true,
      generate: async () => ({ text: modelText, model: "eval-mock" }),
    });

    const report = evaluateBriefOutput(
      "pipeline-brief",
      brief,
      spyNeutralContext,
    );
    expect(report.pass).toBe(true);
    expect(brief.cached).toBe(false);
    expect(brief.provider).toBe("gemini");
  });

  it("answerResearchQuestion stays within rubric on fixture context", async () => {
    const result = await answerResearchQuestion({} as never, {
      message: "Why is SPY neutral on 1d?",
      symbol: "SPY",
      horizon: "1d",
      chat: async () => ({
        text: CHAT_EVAL_CASES[0]!.modelText,
        model: "eval-mock",
      }),
    });

    const report = evaluateChatOutput(
      "pipeline-chat",
      result,
      spyNeutralContext,
      { mustMention: ["SPY", "neutral", "inflation"] },
    );
    expect(report.pass).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
  });
});
