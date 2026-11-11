import { getAdmin } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { resolveContent, rowsToContent } from "@/content/resolve";
import { renderPage } from "@/site/render";

export const dynamic = "force-dynamic";

/** Draft (or historic version) preview, rendered with the real page template. Admins only. */
export async function GET(req: Request) {
  const { user, admin } = await getAdmin();
  if (!user) return Response.redirect(new URL("/admin/login?next=/admin/preview", req.url), 302);
  if (!admin) return new Response("Forbidden", { status: 403 });

  const version = Number(new URL(req.url).searchParams.get("version"));
  const content = await asUser(admin.user_id, async (c) => {
    if (version) {
      const r = await c.query("select snapshot from public.content_versions where version_number = $1", [version]);
      return r.rows[0] ? resolveContent(r.rows[0].snapshot) : null;
    }
    const r = await c.query("select section_id, field_key, draft_value as value from public.page_content");
    return resolveContent(rowsToContent(r.rows));
  });
  if (!content) return new Response(`Version ${version} not found`, { status: 404 });

  const html = renderPage(content, { preview: true, origin: new URL(req.url).origin });
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex" },
  });
}
