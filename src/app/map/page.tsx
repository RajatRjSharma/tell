import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MarketMap } from "@/components/MarketMap";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMarketMap } from "@/lib/market-map";

export const metadata: Metadata = {
  title: "Market map",
  description:
    "Where the world's money sits and how it moved: asset classes, countries, companies and sectors.",
};

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login?next=/map");
  }

  const map = await getMarketMap(getDb());

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
        className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
        data-testid="map-page"
      >
        <p className="font-mono text-xs text-[var(--accent)]">Market map</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
          Where the money sits, and how it moved.
        </h1>
        <div className="mt-8">
          <MarketMap views={map.views} asOf={map.asOf} />
        </div>
      </main>
    </div>
  );
}
