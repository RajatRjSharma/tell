import type { NextRequest } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api/http";
import { getDb } from "@/lib/db";
import { deleteAlertRule, setAlertRuleEnabled } from "@/lib/alerts/store";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return jsonError("Sign in to update alerts", 401);
    }

    const { id: rawId } = await context.params;
    const ruleId = Number(rawId);
    if (!Number.isInteger(ruleId) || ruleId < 1) {
      return jsonError("Invalid rule id", 400);
    }

    const body = (await request.json().catch(() => null)) as {
      enabled?: boolean;
    } | null;
    if (typeof body?.enabled !== "boolean") {
      return jsonError("enabled boolean is required", 400);
    }

    const rule = await setAlertRuleEnabled(
      getDb(),
      session.sub,
      ruleId,
      body.enabled,
    );
    if (!rule) {
      return jsonError("Alert rule not found", 404);
    }

    return jsonOk({ rule });
  } catch (err) {
    console.error("alerts patch error", err);
    return jsonError("Failed to update alert", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return jsonError("Sign in to delete alerts", 401);
    }

    const { id: rawId } = await context.params;
    const ruleId = Number(rawId);
    if (!Number.isInteger(ruleId) || ruleId < 1) {
      return jsonError("Invalid rule id", 400);
    }

    const deleted = await deleteAlertRule(getDb(), session.sub, ruleId);
    if (!deleted) {
      return jsonError("Alert rule not found", 404);
    }

    return jsonOk({ ok: true });
  } catch (err) {
    console.error("alerts delete error", err);
    return jsonError("Failed to delete alert", 500);
  }
}
