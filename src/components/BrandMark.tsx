type BrandSize = "sm" | "md";

const lockupSizeClass = {
  sm: "text-[1.125rem] sm:text-[1.375rem]",
  md: "text-[1.5rem] sm:text-[1.75rem]",
} as const;

/** Background-free bar-chart mark; height follows surrounding font-size (1em). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`flex h-[0.72em] w-[0.78em] shrink-0 items-end justify-center gap-[0.08em] ${className}`.trim()}
      aria-hidden
    >
      <span className="h-[51%] w-[0.22em] rounded-[0.06em] bg-[#78ad68]" />
      <span className="h-[76%] w-[0.22em] rounded-[0.06em] bg-[#d74e4e]" />
      <span className="h-full w-[0.22em] rounded-[0.06em] bg-[#5e9ed6]" />
    </span>
  );
}

export function BrandWordmark({
  size = "sm",
  label = "Tell",
  className = "",
  markClassName = "",
}: {
  size?: BrandSize;
  label?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span
      className={`inline-flex min-w-0 items-baseline gap-[0.28em] leading-none ${lockupSizeClass[size]} ${className}`.trim()}
    >
      <BrandMark className={markClassName} />
      <span className="min-w-0 truncate font-semibold tracking-[-0.045em]">
        {label}
      </span>
    </span>
  );
}
