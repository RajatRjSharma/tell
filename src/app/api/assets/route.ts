import type { NextRequest } from "next/server";
import { isSession, requireApiSession } from "@/lib/api/auth-guard";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (!isSession(auth)) return auth;

  try {
    const db = getDb();
    const result = await db.execute(
      `SELECT symbol, name, asset_class, country_code, currency, source_symbol
       FROM assets
       ORDER BY symbol ASC`,
    );

    const assets = result.rows.map((row) => ({
      symbol: String(row.symbol),
      name: String(row.name),
      assetClass: String(row.asset_class),
      countryCode: row.country_code == null ? null : String(row.country_code),
      currency: row.currency == null ? null : String(row.currency),
      sourceSymbol:
        row.source_symbol == null ? null : String(row.source_symbol),
    }));

    return jsonOk({ assets, count: assets.length });
  } catch (err) {
    console.error("assets error", err);
    return jsonError("Failed to load assets", 500);
  }
}
