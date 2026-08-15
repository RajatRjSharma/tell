import { getDb } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    await db.execute("SELECT 1 AS ok");
    return jsonOk({
      ok: true,
      service: "tell",
      time: new Date().toISOString(),
    });
  } catch (err) {
    console.error("health error", err);
    return jsonError("Database unavailable", 503);
  }
}
