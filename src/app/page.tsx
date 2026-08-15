import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets } from "@/data/seed";
import { listLatestOutlook } from "@/lib/api/outlook";
import { getMacroStrip } from "@/lib/macro/strip";
import { getNearTermRiskBias } from "@/lib/risk/near-term";
import { listWatchlist } from "@/lib/watchlist/store";
import { OutlookDashboard } from "@/components/OutlookDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const db = getDb();
  const [signals, watchlist, macroStrip, nearTermBias] = await Promise.all([
    listLatestOutlook(db),
    session ? listWatchlist(db, session.sub) : Promise.resolve([] as string[]),
    getMacroStrip(db, { limit: 24 }),
    getNearTermRiskBias(db),
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
      initialWatchlist={watchlist}
      initialMacroStrip={macroStrip}
      initialNearTermBias={nearTermBias}
    />
  );
}
