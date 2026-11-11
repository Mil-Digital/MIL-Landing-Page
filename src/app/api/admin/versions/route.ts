import { adminRoute } from "@/lib/admin";
import { asUser } from "@/lib/db";
export const dynamic = "force-dynamic";
export const GET = adminRoute(async ({ admin }) =>
  asUser(admin.user_id, async (c) => ({
    versions: (await c.query("select version_number, note, published_at, published_by_email from public.content_versions order by version_number desc limit 100")).rows,
  })),
);
