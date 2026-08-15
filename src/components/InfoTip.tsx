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
  const [open, setOpen] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    placeTooltip();

    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, placeTooltip]);

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
          setOpen(true);
          placeTooltip();
        }}
        onMouseEnter={() => {
          setOpen(true);
          placeTooltip();
        }}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => {
          setOpen(true);
          placeTooltip();
        }}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && position
        ? createPortal(
            <span
              id={id}
              role="tooltip"
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
