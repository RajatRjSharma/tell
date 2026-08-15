import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import {
  buildHealthReport,
  type CheckStatus,
  type HealthCheck,
  type HealthReport,
} from "@/lib/api/health";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import packageJson from "../../../package.json";

export const metadata: Metadata = {
  title: "System",
  description:
    "Tell service health, configuration presence, and data freshness.",
};

export const dynamic = "force-dynamic";

function statusTone(status: CheckStatus | HealthReport["status"]): string {
  if (status === "ok")
    return "text-[var(--positive)] bg-[var(--positive-soft)]";
  if (status === "degraded")
    return "text-[var(--muted-strong)] bg-[var(--neutral-soft)]";
  if (status === "skip") return "text-[var(--muted)] bg-[var(--surface-hover)]";
  return "text-[var(--negative)] bg-[var(--negative-soft)]";
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PresenceList({
  title,
  values,
}: {
  title: string;
  values: Record<string, boolean>;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {Object.entries(values).map(([key, present]) => (
          <li
            key={key}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="font-mono text-[var(--muted-strong)]">{key}</span>
            <span
              className={`rounded-[6px] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${
                present
                  ? "bg-[var(--positive-soft)] text-[var(--positive)]"
                  : "bg-[var(--negative-soft)] text-[var(--negative)]"
              }`}
            >
              {present ? "set" : "missing"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckCard({ name, check }: { name: string; check: HealthCheck }) {
  const required = check.required as Record<string, boolean> | undefined;
  const optional = check.optional as Record<string, boolean> | undefined;
  const counts = check.counts as Record<string, number> | undefined;

  return (
    <article
      className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5"
      data-testid={`system-check-${name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.02em] capitalize">
            {name}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-strong)]">
            {check.message ?? "No detail"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-[8px] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${statusTone(check.status)}`}
        >
          {check.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 font-mono text-[11px] text-[var(--muted)] sm:grid-cols-2">
        {typeof check.latencyMs === "number" ? (
          <div>
            <dt className="text-[var(--muted)]">Latency</dt>
            <dd className="mt-0.5 text-[var(--text)]">{check.latencyMs} ms</dd>
          </div>
        ) : null}
        {typeof check.node === "string" ? (
          <div>
            <dt className="text-[var(--muted)]">Node</dt>
            <dd className="mt-0.5 text-[var(--text)]">{check.node}</dd>
          </div>
        ) : null}
        {typeof check.appEnv === "string" ? (
          <div>
            <dt className="text-[var(--muted)]">App env</dt>
            <dd className="mt-0.5 text-[var(--text)]">{check.appEnv}</dd>
          </div>
        ) : null}
        {typeof check.env === "string" ? (
          <div>
            <dt className="text-[var(--muted)]">Build mode</dt>
            <dd className="mt-0.5 text-[var(--text)]">{check.env}</dd>
          </div>
        ) : null}
        {typeof check.latestSignalAsOf === "string" ? (
          <div>
            <dt className="text-[var(--muted)]">Latest signal</dt>
            <dd className="mt-0.5 text-[var(--text)]">
              {check.latestSignalAsOf}
            </dd>
          </div>
        ) : null}
        {typeof check.modelVersion === "string" ? (
          <div>
            <dt className="text-[var(--muted)]">Model</dt>
            <dd className="mt-0.5 text-[var(--text)]">{check.modelVersion}</dd>
          </div>
        ) : null}
      </dl>

      {counts ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Object.entries(counts).map(([key, value]) => (
            <div
              key={key}
              className="rounded-[10px] bg-[var(--page)] px-3 py-2"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                {key}
              </p>
              <p className="mt-1 font-mono text-lg tracking-[-0.04em]">
                {value.toLocaleString("en")}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {required || optional ? (
        <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 sm:grid-cols-2">
          {required ? (
            <PresenceList title="Required" values={required} />
          ) : null}
          {optional ? (
            <PresenceList title="Optional" values={optional} />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default async function SystemPage({
  searchParams,
}: {
  searchParams: Promise<{ deep?: string }>;
}) {
  if (!(await getSession())) {
    redirect("/login?next=/system");
  }

  const params = await searchParams;
  const deep = params.deep === "1" || params.deep === "true";

  let db = null;
  try {
    db = getDb();
  } catch {
    db = null;
  }

  const report = await buildHealthReport(db, {
    deep,
    version: packageJson.version,
  });

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#system-content">
        Skip to system status
      </a>

      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
        <div className="site-header-inner mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="site-header-brand group flex items-center gap-3 focus-visible:outline-none"
            aria-label="Tell home"
          >
            <BrandMark className="group-hover:-translate-y-0.5" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              Tell
            </span>
            <span className="hidden h-4 w-px bg-[var(--line-strong)] sm:block" />
            <span className="hidden text-xs text-[var(--muted)] sm:block">
              System
            </span>
          </Link>

          <div className="site-header-nav flex items-center gap-2 text-sm">
            <Link className="nav-link" href="/">
              Outlook
            </Link>
            <Link className="nav-link" href="/methodology">
              Method
            </Link>
            <Link className="nav-link nav-system-link" href="/system">
              System
            </Link>
          </div>
        </div>
      </header>

      <main
        id="system-content"
        className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14"
        data-testid="system-page"
      >
        <p className="font-mono text-xs text-[var(--accent)]">
          Service health · v{report.version}
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              System status
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted-strong)]">
              Live checks for the app process, required configuration, database
              reachability, and research data freshness. Secret values are never
              shown.
            </p>
          </div>
          <span
            className={`rounded-[10px] px-3 py-2 font-mono text-xs uppercase tracking-[0.1em] ${statusTone(report.status)}`}
            data-testid="system-overall-status"
          >
            {report.status}
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          <span className="font-mono">Checked {formatTime(report.time)}</span>
          <span className="h-3 w-px bg-[var(--line-strong)]" />
          <a className="underline underline-offset-2" href="/api/health">
            Raw JSON
          </a>
          {deep ? (
            <Link className="underline underline-offset-2" href="/system">
              Standard checks
            </Link>
          ) : (
            <Link
              className="underline underline-offset-2"
              href="/system?deep=1"
            >
              Deep probe (Yahoo / Finnhub)
            </Link>
          )}
        </div>

        <section className="mt-10 grid gap-4">
          {Object.entries(report.checks).map(([name, check]) => (
            <CheckCard key={name} name={name} check={check} />
          ))}
        </section>
      </main>
    </div>
  );
}
