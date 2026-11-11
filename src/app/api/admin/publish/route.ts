import { revalidatePath, revalidateTag } from "next/cache";
import { adminRoute, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { CONTENT_TAG } from "@/lib/published";

export const dynamic = "force-dynamic";

/** Publish all drafts (the DB function re-checks admin rights) and purge the public page cache. */
export const POST = adminRoute(async ({ req, admin }) => {
  const { note } = await readJson<{ note?: string }>(req);
  const version = await asUser(admin.user_id, (c) =>
    c.query("select public.publish_site($1) as v", [String(note ?? "").slice(0, 300)]).then((r) => r.rows[0].v),
  );
  revalidateTag(CONTENT_TAG, { expire: 0 });
  revalidatePath("/");
  return { version };
});
