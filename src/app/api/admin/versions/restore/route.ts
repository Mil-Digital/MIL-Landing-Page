import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
export const dynamic = "force-dynamic";
export const POST = adminRoute(async ({ req, admin }) => {
  const { version } = await readJson<{ version: number }>(req);
  if (!Number.isInteger(version) || version < 1) throw new HttpError(400, "Invalid version");
  const n = await asUser(admin.user_id, (c) => c.query("select public.restore_version($1) as n", [version]).then((r) => r.rows[0].n));
  return { restoredFields: n };
});
