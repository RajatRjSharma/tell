import type { LocalMacroPoint, LocalMacroRow } from "@/lib/macro/local";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthLabel(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  const name = MONTHS[Number(month) - 1];
  return name && year ? `${name} ${year}` : isoDate;
}

function formatPp(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} pp`;
}

function Metric({
  label,
  point,
  testId,
}: {
  label: string;
  point: LocalMacroPoint | null;
  testId: string;
}) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      {point ? (
        <dd>
          <span className="font-mono text-lg tracking-[-0.03em]">
            {point.value.toFixed(2)}%
          </span>
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">
            {monthLabel(point.asOf)}
            {point.change12m !== null
              ? ` · ${formatPp(point.change12m)} y/y`
              : ""}
          </span>
        </dd>
      ) : (
        <dd className="font-mono text-sm text-[var(--muted)]">n/a</dd>
      )}
    </div>
  );
}

export function LocalMacroPanel({
  rows,
  countryNames,
  scopeLabel,
}: {
  rows: LocalMacroRow[];
  countryNames: Record<string, string>;
  scopeLabel: string;
}) {
  const hasData = rows.some((row) => row.inflation || row.policyRate);

  return (
    <section
      className="mt-10 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6"
      data-testid="local-macro"
      aria-label="Local inflation and policy rates"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
        {scopeLabel} macro
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">
        Local inflation and policy rates
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Latest monthly headline inflation and central bank rate for each country
        in view. A positive real rate means policy is tighter than inflation.
      </p>

      {!hasData ? (
        <p className="mt-5 text-sm text-[var(--muted)]">
          No local macro loaded yet. Run the global macro ingest.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.countryCode}
              className="rounded-[12px] border border-[var(--line)] bg-[var(--page)] p-4"
              data-testid={`local-macro-${row.countryCode}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium">
                  {countryNames[row.countryCode] ?? row.countryCode}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {row.countryCode}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Metric
                  label="Inflation (YoY)"
                  point={row.inflation}
                  testId={`local-inflation-${row.countryCode}`}
                />
                <Metric
                  label={row.countryCode === "DE" ? "ECB rate" : "Policy rate"}
                  point={row.policyRate}
                  testId={`local-policy-${row.countryCode}`}
                />
              </dl>
              {row.realRate !== null ? (
                <p className="mt-3 border-t border-[var(--line)] pt-2 font-mono text-[11px] text-[var(--muted-strong)]">
                  Real rate {formatPp(row.realRate)}
                  {row.realRate >= 0 ? " · tight" : " · loose"}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">
        Sources: IMF Consumer Price Index (monthly) and BIS central bank policy
        rates. Germany shows the euro area ECB rate. Months can lag by one to
        three releases per country.
      </p>
    </section>
  );
}
