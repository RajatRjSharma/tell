import { explainConfidence, explainScore } from "@/lib/charts/explain";
import { DIRECTION_THRESHOLD } from "@/lib/signals/score";

function toPercent(score: number): number {
  return ((Math.max(-1, Math.min(1, score)) + 1) / 2) * 100;
}

export function ScoreTrack({
  score,
  confidence,
}: {
  score: number;
  confidence: number | null;
}) {
  const neutralLeft = toPercent(-DIRECTION_THRESHOLD);
  const neutralWidth = toPercent(DIRECTION_THRESHOLD) - neutralLeft;
  const tone =
    score >= DIRECTION_THRESHOLD
      ? "positive"
      : score <= -DIRECTION_THRESHOLD
        ? "negative"
        : "neutral";

  return (
    <div className="score-track-wrap" data-testid="score-track">
      <div
        className="score-track"
        role="img"
        aria-label={`Score ${score.toFixed(2)} on a scale from −1 bearish to +1 bullish. ${explainScore(score)}`}
      >
        <span
          className="score-track-neutral"
          style={{ left: `${neutralLeft}%`, width: `${neutralWidth}%` }}
        />
        <span className="score-track-mid" />
        <span
          className={`score-track-marker score-track-marker-${tone}`}
          style={{ left: `${toPercent(score)}%` }}
        />
      </div>
      <div className="score-track-scale" aria-hidden="true">
        <span>−1 bearish</span>
        <span>neutral</span>
        <span>bullish +1</span>
      </div>
      <p className="score-track-note" data-testid="score-meaning">
        {explainScore(score)} {explainConfidence(confidence)}
      </p>
    </div>
  );
}
