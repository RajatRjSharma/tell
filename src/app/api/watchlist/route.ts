import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import {
  addWatchlistItem,
  assetExists,
  listWatchlist,
  normalizeWatchSymbol,
  removeWatchlistItem,
} from "@/lib/watchlist/store";

export const dynamic = "force-dynamic";

async function requireUser() {
  const session = await getSession();
  if (!session) return null;
  return session;
}

export async function GET() {
  try {
    const session = await requireUser();
    if (!session) {
      return jsonError("Sign in to view your watchlist", 401);
    }

    const symbols = await listWatchlist(getDb(), session.sub);
    return jsonOk({ symbols });
  } catch (err) {
    console.error("watchlist list error", err);
    return jsonError("Failed to load watchlist", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return jsonError("Sign in to save symbols", 401);
    }

    const body = (await request.json().catch(() => null)) as {
      symbol?: string;
    } | null;
    const symbol = normalizeWatchSymbol(body?.symbol ?? "");
    if (!symbol) {
      return jsonError("Invalid symbol", 400);
    }

    const db = getDb();
    if (!(await assetExists(db, symbol))) {
      return jsonError(`Unknown symbol: ${symbol}`, 404);
    }

    const symbols = await addWatchlistItem(db, session.sub, symbol);
    return jsonOk({ symbols }, { status: 201 });
  } catch (err) {
    console.error("watchlist add error", err);
    return jsonError("Failed to add symbol", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireUser();
    if (!session) {
      return jsonError("Sign in to update your watchlist", 401);
    }

    const fromQuery = request.nextUrl.searchParams.get("symbol");
    let raw = fromQuery ?? "";
    if (!raw) {
      const body = (await request.json().catch(() => null)) as {
        symbol?: string;
      } | null;
      raw = body?.symbol ?? "";
    }

    const symbol = normalizeWatchSymbol(raw);
    if (!symbol) {
      return jsonError("Invalid symbol", 400);
    }

    const symbols = await removeWatchlistItem(getDb(), session.sub, symbol);
    return jsonOk({ symbols });
  } catch (err) {
    console.error("watchlist remove error", err);
    return jsonError("Failed to remove symbol", 500);
  }
}
