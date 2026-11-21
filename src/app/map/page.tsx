import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketMap } from "@/components/MarketMap";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMarketMap } from "@/lib/market-map";
import { MAP_PERIODS, type MapPeriod } from "@/lib/market-map/changes";

export const metadata: Metadata = {
  title: "Market map",
  description:
    "Where the world's money sits and how it moved: asset classes, countries, companies and sectors.",
};

export const dynamic = "force-dynamic";

function isPeriod(value: string | undefined): value is MapPeriod {
  return MAP_PERIODS.some((period) => period === value);
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/map");
  }

  const [map, params] = await Promise.all([
    getMarketMap(getDb()),
    searchParams,
  ]);
  const initialView = map.views.find((view) => view.id === params.view)?.id;

  return (
    <div className="min-h-[100dvh] bg-[var(--page)] text-[var(--text)]">
      <a className="skip-link" href="#map-content">
        Skip to market map
      </a>
      <SiteHeader
        sectionLabel="Market map"
        active="map"
        user={{ email: session.email, username: session.username }}
      />
      <main
        id="map-content"
        className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        data-testid="map-page"
      >
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
              Market map
            </h1>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">
              Where the world&apos;s money sits and how it moved. Size is market
              value; colour is the price move.
            </p>
          </div>
          {map.asOf ? (
            <p
              className="font-mono text-[11px] text-[var(--muted)]"
              data-testid="map-as-of"
            >
              Prices as of {map.asOf}
            </p>
          ) : null}
        </div>
        <MarketMap
          views={map.views}
          initialView={initialView}
          initialPeriod={isPeriod(params.period) ? params.period : undefined}
        />
      </main>
    </div>
  );
}
