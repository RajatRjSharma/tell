export type ResearchContext = {
  asOf: string | null;
  regime: string | null;
  horizon: string;
  symbol: string | null;
  signals: Array<{
    symbol: string;
    horizon: string;
    direction: string;
    score: number;
    confidence: number | null;
    drivers: string[];
  }>;
  macro: Array<{
    indicatorId: string;
    observedFor: string;
    value: number;
    source: string | null;
  }>;
};

export type BriefResult = {
  title: string;
  summary: string;
  bullets: string[];
  risks: string[];
  model: string;
  provider: "gemini";
  asOf: string | null;
  symbol: string | null;
  horizon: string;
  cached: boolean;
  source?: "memory" | "database" | "live";
  disclaimer: string;
};

export type BriefDelta = {
  previousAsOf: string | null;
  titleChanged: boolean;
  summaryChanged: boolean;
  addedBullets: string[];
  removedBullets: string[];
};

export type BriefResponse = BriefResult & {
  previous: BriefResult | null;
  delta: BriefDelta | null;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type ChatResult = {
  answer: string;
  model: string;
  provider: "groq";
  citations: string[];
  disclaimer: string;
};

export const AI_DISCLAIMER =
  "Research aid only. Not financial advice or a guaranteed prediction.";
