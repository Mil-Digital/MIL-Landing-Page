import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Delete analytics data (the database function re-checks rights).
 *  { mode: "older_than", days }  – admin
 *  { mode: "visitor", visitorId } – admin (data-subject request; the visitor ID is shown by
 *                                   window.milAnalytics.visitorId() in the visitor's browser)
 *  { mode: "all", confirm: "HAPUS" } – owner only
 */
export const POST = adminRoute(async ({ req, admin }) => {
  const b = await readJson<{ mode?: string; days?: number; visitorId?: string; confirm?: string }>(req, 10_000);
  let args: [string, number | null, string | null];
  if (b.mode === "older_than") {
    const days = Math.round(Number(b.days));
    if (!Number.isFinite(days) || days < 30) throw new HttpError(400, "Minimal 30 hari");
    args = ["older_than", days, null];
  } else if (b.mode === "visitor") {
    if (!UUID.test(String(b.visitorId ?? ""))) throw new HttpError(400, "Visitor ID tidak valid");
    args = ["visitor", null, String(b.visitorId).toLowerCase()];
  } else if (b.mode === "all") {
    if (b.confirm !== "HAPUS") throw new HttpError(400, "Ketik HAPUS untuk konfirmasi");
    if (admin.role !== "owner") throw new HttpError(403, "Hanya owner yang dapat menghapus semua data");
    args = ["all", null, null];
  } else throw new HttpError(400, "Mode tidak dikenal");

  const deleted = await asUser(admin.user_id, (c) =>
    c.query("select public.analytics_purge($1, $2, $3::uuid) as n", args).then((r) => r.rows[0].n as number),
  );
  return { deleted };
});
