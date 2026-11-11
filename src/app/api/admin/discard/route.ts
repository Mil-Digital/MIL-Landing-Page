import { adminRoute } from "@/lib/admin";
import { asUser } from "@/lib/db";
export const dynamic = "force-dynamic";
export const POST = adminRoute(async ({ admin }) => ({
  discarded: await asUser(admin.user_id, (c) => c.query("select public.discard_draft() as n").then((r) => r.rows[0].n)),
}));
