type BrandMarkProps = {
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
} as const;

/** Shared Tell mark — same asset as favicon/icon. */
export function BrandMark({ size = "sm", className = "" }: BrandMarkProps) {
  return (
    <span
      className={`grid ${sizeClass[size]} place-items-center overflow-hidden rounded-[10px] bg-[var(--text)] transition-transform ${className}`.trim()}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- favicon.ico multi-size ICO */}
      <img
        src="/favicon.ico"
        alt=""
        width={size === "md" ? 36 : 32}
        height={size === "md" ? 36 : 32}
        className="h-[72%] w-[72%] object-contain"
      />
    </span>
  );
}
