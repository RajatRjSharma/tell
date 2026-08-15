import type { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { jsonError, jsonOk, parseLimit } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import {
  countUnreadAlertEvents,
  createAlertRule,
  listAlertEvents,
  listAlertRules,
} from "@/lib/alerts/store";
import {
  ALERT_DIRECTIONS,
  isAlertDirection,
  isAlertRuleType,
} from "@/lib/alerts/types";
import {
  assetExists,
  listWatchlist,
  normalizeWatchSymbol,
} from "@/lib/watchlist/store";

export const dynamic = "force-dynamic";

const HORIZONS = new Set(["1d", "1w", "1m"]);

export async function GET(request: NextRequest) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return jsonError("Sign in to view alerts", 401);
    }

    const limit = parseLimit(
      request.nextUrl.searchParams.get("limit"),
      30,
      100,
    );
    const db = getDb();
    const [rules, events, unreadCount] = await Promise.all([
      listAlertRules(db, session.sub),
      listAlertEvents(db, session.sub, { limit }),
      countUnreadAlertEvents(db, session.sub),
    ]);

    return jsonOk({ rules, events, unreadCount });
  } catch (err) {
    console.error("alerts list error", err);
    return jsonError("Failed to load alerts", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return jsonError("Sign in to create alerts", 401);
    }

    const body = (await request.json().catch(() => null)) as {
      symbol?: string;
      horizon?: string;
      ruleType?: string;
      ruleValue?: string | number | null;
    } | null;

    const symbol = normalizeWatchSymbol(body?.symbol ?? "");
    if (!symbol) {
      return jsonError("Invalid symbol", 400);
    }

    const horizon = (body?.horizon ?? "1d").trim().toLowerCase();
    if (!HORIZONS.has(horizon)) {
      return jsonError("horizon must be 1d, 1w, or 1m", 400);
    }

    const ruleTypeRaw = (body?.ruleType ?? "").trim();
    if (!isAlertRuleType(ruleTypeRaw)) {
      return jsonError(
        "ruleType must be direction_change, became_direction, or confidence_below",
        400,
      );
    }

    let ruleValue: string | null = null;
    if (ruleTypeRaw === "became_direction") {
      const direction = String(body?.ruleValue ?? "")
        .trim()
        .toLowerCase();
      if (!isAlertDirection(direction)) {
        return jsonError(
          `ruleValue must be one of ${ALERT_DIRECTIONS.join(", ")}`,
          400,
        );
      }
      ruleValue = direction;
    } else if (ruleTypeRaw === "confidence_below") {
      const threshold = Number(body?.ruleValue);
      if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) {
        return jsonError("ruleValue must be a confidence between 0 and 1", 400);
      }
      ruleValue = String(threshold);
    }

    const db = getDb();
    if (!(await assetExists(db, symbol))) {
      return jsonError(`Unknown symbol: ${symbol}`, 404);
    }

    const watchlist = await listWatchlist(db, session.sub);
    if (!watchlist.includes(symbol)) {
      return jsonError(
        "Add the symbol to your watchlist before creating an alert",
        400,
      );
    }

    const rule = await createAlertRule(db, {
      userId: session.sub,
      symbol,
      horizon,
      ruleType: ruleTypeRaw,
      ruleValue,
    });

    return jsonOk({ rule }, { status: 201 });
  } catch (err) {
    console.error("alerts create error", err);
    return jsonError("Failed to create alert", 500);
  }
}
