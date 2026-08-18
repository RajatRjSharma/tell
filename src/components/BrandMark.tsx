type BrandSize = "sm" | "md";

const lockupSizeClass = {
  sm: "text-[1.0625rem] sm:text-[1.25rem]",
  md: "text-[1.5rem] lg:text-[1.75rem]",
} as const;

/** Same geometry as `src/app/icon.svg`, sized relative to the wordmark. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={`h-[1.42em] w-[1.42em] shrink-0 ${className}`.trim()}
      aria-hidden
    >
      <rect x="4" y="16.88" width="7" height="15.12" rx="2" fill="#78ad68" />
      <rect x="14.5" y="9.68" width="7" height="22.32" rx="2" fill="#d74e4e" />
      <rect x="25" y="2.48" width="7" height="29.52" rx="2" fill="#5e9ed6" />
    </svg>
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
      className={`inline-flex min-w-0 items-center gap-[0.38em] leading-none ${lockupSizeClass[size]} ${className}`.trim()}
    >
      <BrandMark className={markClassName} />
      <span className="min-w-0 truncate pt-[0.06em] font-semibold tracking-[-0.05em]">
        {label}
      </span>
    </span>
  );
}
