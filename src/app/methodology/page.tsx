import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EconomicTerm } from "@/components/EconomicTerm";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How Tell builds regimes, multi-horizon outlooks, event impact studies, and quality metrics - research aid only.",
};

const SECTIONS = [
  { id: "purpose", label: "Purpose" },
  { id: "data", label: "Data" },
  { id: "regimes", label: "Regimes" },
  { id: "signals", label: "Signals" },
  { id: "quality", label: "Quality" },
  { id: "events", label: "Events" },
  { id: "ai", label: "AI" },
  { id: "limits", label: "Limits" },
  { id: "disclaimer", label: "Disclaimer" },
] as const;

export default async function MethodologyPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/methodology");
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#methodology-content">
        Skip to methodology
      </a>

      <SiteHeader
        sectionLabel="Methodology"
        active="methodology"
        user={{ email: session.email, username: session.username }}
      />

      <main
        id="methodology-content"
        className="mx-auto grid max-w-[1480px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_minmax(0,48rem)] lg:gap-16 lg:px-8 lg:py-14"
      >
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
            On this page
          </p>
          <nav className="mt-4 flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-[8px] px-2 py-1.5 text-sm text-[var(--muted-strong)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <p className="font-mono text-xs text-[var(--accent)]">
            Research transparency · {SIGNAL_MODEL_VERSION}
          </p>
          <h1 className="mt-4 max-w-2xl text-balance text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
            How Tell reads the market.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--muted-strong)]">
            Tell turns free macro, market, and policy feeds into explainable
            multi-horizon outlooks. Rules score. Models explain. Hit rates keep
            us honest.
          </p>

          <section id="purpose" className="mt-14 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Purpose
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              Tell is a personal research aid for global activity → asset
              context. It does not place trades, guarantee returns, or replace
              judgment. Every outlook is a structured hypothesis with drivers,
              confidence, and a track record.
            </p>
          </section>

          <section id="data" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">Data</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted-strong)]">
              <li>
                <strong className="text-[var(--text)]">Macro</strong> - FRED for
                US series; IMF / World Bank for cross-country readings.
              </li>
              <li>
                <strong className="text-[var(--text)]">Markets</strong> - daily
                OHLC for equities, FX, commodities, and rates ETFs (Yahoo;
                Finnhub optional for live overlays).
              </li>
              <li>
                <strong className="text-[var(--text)]">Policy events</strong> -
                Fed, ECB, and BoE RSS releases, tagged with light hawkish /
                dovish keywords.
              </li>
            </ul>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              Ingest runs daily via GitHub Actions. Features and signals are
              computed point-in-time on daily bars (no intraday dependency).
            </p>
          </section>

          <section id="regimes" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Regimes
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              A US <EconomicTerm term="regime">regime label</EconomicTerm> is
              derived from a small FRED-derived set:{" "}
              <EconomicTerm term="cpi">CPI YoY</EconomicTerm>, industrial
              production YoY, Fed funds, the{" "}
              <EconomicTerm term="yieldCurve">10Y-2Y curve</EconomicTerm>, and{" "}
              <EconomicTerm term="vix">VIX</EconomicTerm> when available.
              Priority is explicit:
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-[var(--muted-strong)]">
              <li>
                <strong className="text-[var(--text)]">
                  <EconomicTerm term="riskOff">Risk-off stress</EconomicTerm>
                </strong>{" "}
                - VIX ≥ 30, or VIX ≥ 25 with an inverted curve
              </li>
              <li>
                <strong className="text-[var(--text)]">
                  Inflation pressure
                </strong>{" "}
                - hot CPI YoY with non-collapsing growth
              </li>
              <li>
                <strong className="text-[var(--text)]">Slowdown</strong> - weak
                growth and/or inverted{" "}
                <EconomicTerm term="yieldCurve">curve</EconomicTerm>
              </li>
              <li>
                <strong className="text-[var(--text)]">Expansion</strong> -
                solid growth, calm vol, non-inverted curve
              </li>
              <li>
                <strong className="text-[var(--text)]">
                  Neutral / unclear
                </strong>{" "}
                - otherwise
              </li>
            </ol>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              The home page shows a beginner explainer with the live inputs,
              thresholds, and usual asset-class tilts. The same US regime still
              biases different asset classes differently in rules-v1 (e.g.
              inflation pressure is typically harder for long duration, mixed
              for equities, more constructive for commodities).
            </p>
          </section>

          <section id="signals" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Signals ({SIGNAL_MODEL_VERSION})
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              For each asset and{" "}
              <EconomicTerm term="horizon">forecast period</EconomicTerm> (Next
              session / ~1 week / ~1 month means about 1 / 5 / 21{" "}
              <EconomicTerm term="sessions">trading sessions</EconomicTerm>),
              Tell blends:
            </p>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted-strong)]">
              <li>
                <EconomicTerm term="regime">Regime bias</EconomicTerm> by asset
                class
              </li>
              <li>
                Period-matched{" "}
                <EconomicTerm term="momentum">momentum</EconomicTerm>
              </li>
              <li>
                <EconomicTerm term="volatility">Volatility</EconomicTerm>{" "}
                caution and{" "}
                <EconomicTerm term="drawdown">drawdown</EconomicTerm> context
              </li>
            </ul>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              The <EconomicTerm term="signalScore">weighted score</EconomicTerm>{" "}
              maps to{" "}
              <strong className="text-[var(--text)]">
                <EconomicTerm term="bullish">bullish</EconomicTerm>
              </strong>{" "}
              (at least +0.15),{" "}
              <strong className="text-[var(--text)]">
                <EconomicTerm term="bearish">bearish</EconomicTerm>
              </strong>{" "}
              (at most -0.15), or{" "}
              <strong className="text-[var(--text)]">
                <EconomicTerm term="neutral">neutral</EconomicTerm>
              </strong>
              . <EconomicTerm term="confidence">Evidence strength</EconomicTerm>{" "}
              rises when more model inputs are active and the score is farther
              from neutral. It is capped at 90% and is{" "}
              <strong className="text-[var(--text)]">not</strong> a probability
              of being correct.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              Drivers are stored as human-readable evidence on each signal - the
              UI shows why, not just a color.
            </p>
          </section>

          <section id="quality" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Quality
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              Every scored signal can be logged and later graded against
              realized forward returns once enough bars exist. Neutral calls use
              a band that widens with horizon length. The dashboard hit-rate
              panel reports directional accuracy by horizon, including after
              historical backfill, so thin samples are visible, not hidden.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              Hit rates are descriptive, not a promise of future edge. Markets
              regime-shift; calibration can decay.
            </p>
          </section>

          <section id="events" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Events &amp; impact
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              Policy RSS items are stored with source, date, and optional tone
              tags. The impact study measures median forward returns (and % of
              up moves) for related assets after similar Fed / ECB / BoE
              releases at 1d / 1w / 1m. You can filter hawkish vs dovish
              analogues.
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-strong)]">
              These are historical analogues, not causal claims. Sample size is
              limited by free RSS coverage and market history.
            </p>
          </section>

          <section id="ai" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">AI</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              Gemini briefs and Groq chat reason over Turso facts (signals,
              macro, recent policy events). They explain and connect evidence;
              they do not invent prices.
            </p>
          </section>

          <section id="limits" className="mt-12 scroll-mt-28">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Limits
            </h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-[var(--muted-strong)]">
              <li>Daily bars only, not intraday trading signals.</li>
              <li>
                Priority US macro series store ALFRED vintages (realtime_start)
                alongside current FRED prints; live features still read the
                current vintage.
              </li>
              <li>
                RSS coverage and keyword tone tags are incomplete versus a full
                event calendar.
              </li>
              <li>
                Free data APIs can gap, delay, or change; health checks surface
                freshness.
              </li>
            </ul>
          </section>

          <section
            id="disclaimer"
            className="mt-12 scroll-mt-28 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6"
            data-testid="methodology-disclaimer"
          >
            <h2 className="text-xl font-semibold tracking-[-0.035em]">
              Disclaimer
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--muted-strong)]">
              Tell is a research tool only. Nothing here is financial,
              investment, legal, or tax advice. Outlooks, briefs, chat answers,
              and impact studies can be wrong. Do your own work; past analogue
              returns and model hit rates do not guarantee future results.
            </p>
          </section>

          <p className="mt-12 text-sm text-[var(--muted)]">
            Questions on the live book?{" "}
            <Link href="/" className="underline underline-offset-2">
              Back to outlook
            </Link>
            .
          </p>
        </article>
      </main>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-6 text-xs text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Tell turns macro data into explainable market context.</span>
          <span className="font-mono">Not financial advice.</span>
        </div>
      </footer>
    </div>
  );
}
