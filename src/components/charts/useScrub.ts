"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { nearestIndex } from "@/lib/charts/scrub";

/**
 * Hover, touch, and keyboard "scrubbing" over an SVG chart. `xs` are point
 * x positions in viewBox units, ascending.
 */
export function useScrub(xs: number[], viewWidth: number) {
  const [index, setIndex] = useState<number | null>(null);

  function fromPointer(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || xs.length === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * viewWidth;
    setIndex(nearestIndex(xs, x));
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (xs.length === 0) return;
    const last = xs.length - 1;
    const current = index ?? last;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(current - 1, 0)
        : event.key === "ArrowRight"
          ? Math.min(current + 1, last)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (event.key === "Escape") {
      setIndex(null);
      return;
    }
    if (next == null) return;
    event.preventDefault();
    setIndex(next);
  }

  const active = index != null && index < xs.length ? index : null;

  return {
    index: active,
    clear: () => setIndex(null),
    svgProps: {
      tabIndex: 0,
      style: { touchAction: "pan-y" as const },
      onPointerMove: fromPointer,
      onPointerDown: fromPointer,
      // Touch keeps the last reading visible so it can be read after lifting.
      onPointerLeave: (event: PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === "mouse") setIndex(null);
      },
      onFocus: () => setIndex((current) => current ?? xs.length - 1),
      onBlur: () => setIndex(null),
      onKeyDown,
    },
  };
}
