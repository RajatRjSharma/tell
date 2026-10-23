import type { ReactNode } from "react";
import { tooltipAlign } from "@/lib/charts/scrub";

/** Floating readout positioned over a chart; `ratio` is 0–1 across the width. */
export function ChartTooltip({
  ratio,
  children,
  testId,
}: {
  ratio: number;
  children: ReactNode;
  testId?: string;
}) {
  const align = tooltipAlign(ratio);
  return (
    <div
      className={`chart-tooltip chart-tooltip-${align}`}
      style={{ left: `${ratio * 100}%` }}
      data-testid={testId}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
