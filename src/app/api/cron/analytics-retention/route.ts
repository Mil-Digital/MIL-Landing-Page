import { pool } from "@/lib/db";
import { DB_CONFIGURED } from "@/lib/env";
import { ANALYTICS } from "@/lib/analytics/config";

export const dynamic = "force-dynamic";

/**
 * Daily retention job (vercel.json → crons). Vercel sends `Authorization: Bearer $CRON_SECRET`.
 * Deletes analytics sessions (and their page views / events) older than ANALYTICS_RETENTION_DAYS.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!DB_CONFIGURED) return Response.json({ skipped: "database not configured" });
  const r = await pool.query("select public.analytics_purge('older_than', $1) as n", [ANALYTICS.retentionDays]);
  return Response.json({ deletedSessions: r.rows[0].n, retentionDays: ANALYTICS.retentionDays });
}
