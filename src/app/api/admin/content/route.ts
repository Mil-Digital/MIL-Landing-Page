import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { getSection, sectionFields } from "@/content/schema";
import { validateFields } from "@/content/validate";

export const dynamic = "force-dynamic";

/** All content rows (draft + published) and site status. */
export const GET = adminRoute(async ({ admin }) =>
  asUser(admin.user_id, async (c) => {
    const rows = await c.query("select section_id, field_key, field_type, draft_value, published_value, updated_at from public.page_content");
    const status = await c.query("select last_draft_saved_at, last_draft_saved_by_email, last_published_at, last_published_by_email, published_version from public.site_status where id = 1");
    return { rows: rows.rows, status: status.rows[0] ?? null };
  }),
);

type Item = { section_id: string; field_key: string; draft_value: unknown };

/** Save drafts. Every field is checked against the schema and validated server-side. */
export const PUT = adminRoute(async ({ req, admin }) => {
  const { items } = await readJson<{ items: Item[] }>(req);
  if (!Array.isArray(items) || !items.length || items.length > 100) throw new HttpError(400, "No items");
  const rows = items.map((it) => {
    const section = getSection(String(it.section_id));
    const field = section && sectionFields(section).find((f) => f.key === it.field_key);
    if (!section || !field) throw new HttpError(400, `Unknown field ${it.section_id}.${it.field_key}`);
    const errs = validateFields([field], { [field.key]: it.draft_value });
    const first = Object.entries(errs)[0];
    if (first) throw new HttpError(400, `${section.label} › ${field.label}: ${first[1]}`);
    return { section_id: section.id, field_key: field.key, field_type: field.type, draft_value: JSON.stringify(it.draft_value ?? null) };
  });
  await asUser(admin.user_id, async (c) => {
    for (const r of rows) {
      await c.query(
        `insert into public.page_content (section_id, field_key, field_type, draft_value) values ($1, $2, $3, $4::jsonb)
         on conflict (section_id, field_key) do update set field_type = excluded.field_type, draft_value = excluded.draft_value`,
        [r.section_id, r.field_key, r.field_type, r.draft_value],
      );
    }
  });
  return { saved: rows.length };
});
