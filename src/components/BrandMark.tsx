type BrandSize = "sm" | "md";

type BrandMarkProps = {
  size?: BrandSize;
  className?: string;
};

const markSizeClass = {
  sm: "h-7 w-7 sm:h-9 sm:w-9",
  md: "h-9 w-9 sm:h-11 sm:w-11",
} as const;

const barWidthClass = {
  sm: "w-[5px] sm:w-[7px]",
  md: "w-[6px] sm:w-[7px]",
} as const;

const wordSizeClass = {
  sm: "text-[1.0625rem] font-semibold leading-none tracking-[-0.04em] sm:text-[1.25rem]",
  md: "text-[1.25rem] font-semibold leading-none tracking-[-0.045em] sm:text-[1.625rem]",
} as const;

const lockupGapClass = {
  sm: "gap-1.5 sm:gap-2.5",
  md: "gap-2 sm:gap-2.5",
} as const;

/** Background-free bar-chart mark derived from the app icon. */
export function BrandMark({ size = "sm", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`flex ${markSizeClass[size]} shrink-0 items-end justify-center gap-[2px] sm:gap-[3px] ${className}`.trim()}
      aria-hidden
    >
      <span
        className={`h-[42%] ${barWidthClass[size]} rounded-[2px] bg-[#78ad68]`}
      />
      <span
        className={`h-[62%] ${barWidthClass[size]} rounded-[2px] bg-[#d74e4e]`}
      />
      <span
        className={`h-[82%] ${barWidthClass[size]} rounded-[2px] bg-[#5e9ed6]`}
      />
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
      className={`inline-flex min-w-0 items-center ${lockupGapClass[size]} ${className}`.trim()}
    >
      <BrandMark size={size} className={markClassName} />
      <span className={`min-w-0 truncate ${wordSizeClass[size]}`}>{label}</span>
    </span>
  );
}
