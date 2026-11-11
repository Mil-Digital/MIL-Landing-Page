import { adminRoute } from "@/lib/admin";
import { asUser } from "@/lib/db";
export const dynamic = "force-dynamic";
export const GET = adminRoute(async ({ admin }) => ({
  me: admin,
  team: await asUser(admin.user_id, (c) => c.query("select email, full_name, role, created_at from public.admin_users order by created_at").then((r) => r.rows)),
}));
