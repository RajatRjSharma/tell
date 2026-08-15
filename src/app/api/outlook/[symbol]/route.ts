import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonError, jsonOk, parseOptionalDate } from "@/lib/api/http";
import { listLatestOutlook } from "@/lib/api/outlook";
import { fetchLiveQuote } from "@/lib/quotes";
import { SIGNAL_MODEL_VERSION } from "@/lib/signals/score";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ symbol: string }> },
) {
  try {
    const { symbol: raw } = await context.params;
    const symbol = decodeURIComponent(raw).trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9.=_-]{1,20}$/.test(symbol)) {
      return jsonError("Invalid symbol", 400);
    }

    const sp = request.nextUrl.searchParams;
    const asOfDate = parseOptionalDate(sp.get("asOf"));
    if (sp.get("asOf") && !asOfDate) {
      return jsonError("asOf must be YYYY-MM-DD", 400);
    }

    const wantLive = sp.get("live") === "1" || sp.get("live") === "true";

    const db = getDb();
    const assetResult = await db.execute({
      sql: `SELECT symbol, name, asset_class, country_code, currency, source_symbol
            FROM assets WHERE symbol = ?`,
      args: [symbol],
    });

    const assetRow = assetResult.rows[0];
    if (!assetRow) {
      return jsonError(`Unknown symbol: ${symbol}`, 404);
    }

    const signals = await listLatestOutlook(db, {
      asOfDate,
      symbols: [symbol],
    });

    let quote = null;
    if (wantLive && assetRow.source_symbol) {
      try {
        quote = await fetchLiveQuote(symbol, String(assetRow.source_symbol));
      } catch (err) {
        console.warn("live quote failed", symbol, err);
      }
    }

    return jsonOk({
      asset: {
        symbol: String(assetRow.symbol),
        name: String(assetRow.name),
        assetClass: String(assetRow.asset_class),
        countryCode:
          assetRow.country_code == null ? null : String(assetRow.country_code),
        currency: assetRow.currency == null ? null : String(assetRow.currency),
        sourceSymbol:
          assetRow.source_symbol == null
            ? null
            : String(assetRow.source_symbol),
      },
      modelVersion: SIGNAL_MODEL_VERSION,
      asOf: signals[0]?.asOfDate ?? asOfDate,
      signals,
      quote,
      disclaimer:
        "Research aid only. Not financial advice or guaranteed predictions.",
    });
  } catch (err) {
    console.error("outlook symbol error", err);
    return jsonError("Failed to load outlook", 500);
  }
}
