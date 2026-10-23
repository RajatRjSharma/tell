import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets, countries } from "@/data/seed";
import { listLatestOutlook } from "@/lib/api/outlook";
import { getLocalMacro } from "@/lib/macro/local";
import { getMacroStrip } from "@/lib/macro/strip";
import { getNearTermRiskBias } from "@/lib/risk/near-term";
import { getRegimeExplainer } from "@/lib/features/regime-snapshot";
import { listWatchlist } from "@/lib/watchlist/store";
import { OutlookDashboard } from "@/components/OutlookDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const db = getDb();
  const [
    signals,
    watchlist,
    macroStrip,
    nearTermBias,
    regimeExplainer,
    localMacro,
  ] = await Promise.all([
    listLatestOutlook(db),
    listWatchlist(db, session.sub),
    getMacroStrip(db, { limit: 24 }),
    getNearTermRiskBias(db),
    getRegimeExplainer(db).catch((err) => {
      console.error("regime explainer load failed", err);
      return null;
    }),
    getLocalMacro(
      db,
      countries.map((country) => country.code),
    ).catch((err) => {
      console.error("local macro load failed", err);
      return [];
    }),
  ]);

  return (
    <OutlookDashboard
      user={{
        id: session.sub,
        email: session.email,
        username: session.username,
      }}
      assets={assets.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        assetClass: asset.asset_class,
        countryCode: asset.country_code,
        currency: asset.currency,
      }))}
      countries={countries.map((country) => ({
        code: country.code,
        name: country.name,
        region: country.region,
      }))}
      initialSignals={signals}
      initialWatchlist={watchlist}
      initialMacroStrip={macroStrip}
      initialNearTermBias={nearTermBias}
      initialRegimeExplainer={regimeExplainer}
      initialLocalMacro={localMacro}
    />
  );
}
