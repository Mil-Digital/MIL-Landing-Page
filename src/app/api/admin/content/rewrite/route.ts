import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { rewriteDraftUrls } from "@/lib/media-server";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Point every draft reference of URL `from` to `to` (used when moving original assets to storage). */
export const POST = adminRoute(async ({ req, admin }) => {
  const b = await readJson<{ from: string; to: string; width?: number; height?: number }>(req);
  // only: bundled original asset -> a file in our own bucket
  if (!/^\/assets\/[\w.-]+$/.test(b.from ?? "") || !String(b.to ?? "").startsWith(publicUrl(""))) throw new HttpError(400, "Invalid URLs");
  const n = await asUser(admin.user_id, (c) => rewriteDraftUrls(c, b.from, b.to, b.width, b.height));
  return { updatedFields: n };
});
