import type { PoolClient } from "pg";
import { HttpError } from "./admin";
import { checkFile, KEY_RE, kindOf } from "@/content/media-rules";
import { deleteObject, headObject, publicUrl } from "./storage";
import { S3 } from "./env";


/** Swap a URL in every draft value (also refreshes width/height stored next to it). Returns #fields changed. */
export async function rewriteDraftUrls(c: PoolClient, from: string, to: string, width?: number | null, height?: number | null) {
  const { rows } = await c.query<{ section_id: string; field_key: string; draft_value: unknown }>(
    "select section_id, field_key, draft_value from public.page_content where draft_value::text like '%' || $1 || '%'",
    [JSON.stringify(from).slice(1, -1)],
  );
  const swap = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.url === from) {
        const next: Record<string, unknown> = { ...o, url: to };
        if (width && height && ("width" in o || "alt" in o)) Object.assign(next, { width, height });
        return next;
      }
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, swap(x)]));
    }
    return v;
  };
  let n = 0;
  for (const r of rows) {
    const next = swap(r.draft_value);
    if (JSON.stringify(next) === JSON.stringify(r.draft_value)) continue;
    await c.query("update public.page_content set draft_value = $3::jsonb where section_id = $1 and field_key = $2", [r.section_id, r.field_key, JSON.stringify(next)]);
    n++;
  }
  return n;
}

/** Where is a URL referenced? */
export async function usage(c: PoolClient, url: string) {
  const needle = JSON.stringify(url).slice(1, -1);
  const { rows } = await c.query<{ draft: boolean; live: boolean }>(
    `select coalesce(bool_or(draft_value::text like '%' || $1 || '%'), false) as draft,
            coalesce(bool_or(published_value::text like '%' || $1 || '%'), false) as live
       from public.page_content`,
    [needle],
  );
  return rows[0];
}

export type RegisterBody = { key: string; fileName: string; width?: number; height?: number; duration?: number };

/** Verify an uploaded object really exists and matches the rules; delete it otherwise. */
export async function verifyUploaded(b: RegisterBody) {
  if (!KEY_RE.test(String(b.key ?? ""))) throw new HttpError(400, "Invalid storage key");
  const head = await headObject(b.key).catch(() => null);
  if (!head) throw new HttpError(400, "File tidak ditemukan di storage — upload gagal.");
  const problem = checkFile(head.contentType, head.size);
  if (problem) {
    await deleteObject(b.key).catch(() => {});
    throw new HttpError(400, problem);
  }
  const int = (n: unknown) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Math.round(Number(n)) : null);
  return {
    bucket: S3.bucket,
    storage_path: b.key,
    public_url: publicUrl(b.key),
    file_name: String(b.fileName ?? b.key).slice(0, 200),
    mime_type: head.contentType,
    kind: kindOf(head.contentType),
    size_bytes: head.size,
    width: int(b.width),
    height: int(b.height),
    duration_seconds: Number.isFinite(Number(b.duration)) && Number(b.duration) > 0 ? Math.round(Number(b.duration) * 10) / 10 : null,
  };
}

