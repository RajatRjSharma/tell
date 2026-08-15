type BrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
} as const;

/** Background-free bar-chart mark derived from the app icon. */
export function BrandMark({ size = "sm", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`flex ${sizeClass[size]} shrink-0 items-end justify-center gap-[3px] pb-1 transition-transform ${className}`.trim()}
      aria-hidden
    >
      <span className="h-[42%] w-[7px] rounded-[2px] bg-[#78ad68]" />
      <span className="h-[62%] w-[7px] rounded-[2px] bg-[#d74e4e]" />
      <span className="h-[82%] w-[7px] rounded-[2px] bg-[#5e9ed6]" />
    </span>
  );
}
