"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Position = {
  left: number;
  top: number;
  placement: "above" | "below";
};

export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ignoreScrollUntilRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const placeTooltip = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const placement = rect.top > 150 ? "above" : "below";
    setPosition({
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 132),
        window.innerWidth - 132,
      ),
      top: placement === "above" ? rect.top - 10 : rect.bottom + 10,
      placement,
    });
  }, []);

  const show = useCallback(() => {
    ignoreScrollUntilRef.current = Date.now() + 250;
    setOpen(true);
    placeTooltip();
  }, [placeTooltip]);

  const hide = useCallback(() => {
    setPinned(false);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    placeTooltip();

    const onResize = () => hide();
    const onScroll = () => {
      if (Date.now() < ignoreScrollUntilRef.current) return;
      hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, placeTooltip, hide]);

  return (
    <span className="inline-flex align-middle">
      <button
        ref={triggerRef}
        type="button"
        className="info-tip-trigger"
        aria-label={`What does ${label} mean?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => {
          if (pinned) {
            hide();
            return;
          }
          setPinned(true);
          show();
        }}
        onMouseEnter={() => {
          if (!pinned) show();
        }}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
        onFocus={() => {
          if (!pinned) show();
        }}
        onBlur={() => {
          if (!pinned) setOpen(false);
        }}
      >
        i
      </button>
      {open && position
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              data-testid="info-tip"
              className="info-tip-content"
              data-placement={position.placement}
              style={{ left: position.left, top: position.top }}
            >
              {children}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
