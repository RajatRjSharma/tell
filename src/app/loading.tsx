export default function Loading() {
  return (
    <main
      className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]"
      aria-label="Loading market outlook"
    >
      <div className="h-16 border-b border-[var(--line)]" />
      <div className="mx-auto max-w-[1480px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-4 w-36 animate-pulse rounded-[7px] bg-[var(--neutral-soft)]" />
        <div className="mt-6 h-16 max-w-3xl animate-pulse rounded-[12px] bg-[var(--neutral-soft)] sm:h-24" />
        <div className="mt-10 grid gap-px overflow-hidden rounded-[16px] bg-[var(--line)] sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse bg-[var(--surface)]"
            />
          ))}
        </div>
        <div className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="h-[32rem] animate-pulse rounded-[16px] bg-[var(--surface)]" />
          <div className="h-[29rem] animate-pulse rounded-[16px] bg-[var(--surface)]" />
        </div>
      </div>
    </main>
  );
}
