"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[var(--page)] px-5 text-[var(--text)]">
      <section className="w-full max-w-lg rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-7 sm:p-9">
        <span className="font-mono text-[11px] text-[var(--negative)]">
          Data connection interrupted
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em]">
          The outlook could not load.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted-strong)]">
          Check the API health endpoint or retry the request. Your stored market
          data has not been changed.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="button-primary">
            Try again
          </button>
          <a href="/api/health" className="button-secondary">
            Check system
          </a>
        </div>
      </section>
    </main>
  );
}
