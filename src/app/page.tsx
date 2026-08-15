import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets } from "@/data/seed";
import { listLatestOutlook } from "@/lib/api/outlook";
import { OutlookDashboard } from "@/components/OutlookDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, signals] = await Promise.all([
    getSession(),
    listLatestOutlook(getDb()),
  ]);

  return (
    <OutlookDashboard
      user={session ? { id: session.sub, email: session.email } : null}
      assets={assets.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.asset_class,
        countryCode: asset.country_code,
        currency: asset.currency,
      }))}
      initialSignals={signals}
    />
  );
}
