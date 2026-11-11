import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { deleteObject } from "@/lib/storage";
import { rewriteDraftUrls, usage, verifyUploaded, type RegisterBody } from "@/lib/media-server";

export const dynamic = "force-dynamic";
const COLS = "id, storage_path, public_url, file_name, mime_type, kind, size_bytes, width, height, duration_seconds, alt_text, created_at, updated_at";
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Replace the file behind an asset. The new file has a new URL (no stale CDN cache); every DRAFT
 * reference is switched to it. Published content keeps the old file until the next publish.
 */
export const PATCH = adminRoute<{ id: string }>(async ({ req, admin, params }) => {
  if (!UUID.test(params.id)) throw new HttpError(400, "Invalid id");
  const m = await verifyUploaded(await readJson<RegisterBody>(req));
  const res = await asUser(admin.user_id, async (c) => {
    const old = (await c.query(`select ${COLS}, bucket, uploaded_by from public.media_assets where id = $1`, [params.id])).rows[0];
    if (!old) throw new HttpError(404, "Media tidak ditemukan");
    if (old.kind !== m.kind) throw new HttpError(400, old.kind === "image" ? "File pengganti harus berupa gambar." : "File pengganti harus berupa video.");
    const updated = (await c.query(
      `update public.media_assets set storage_path=$2, public_url=$3, file_name=$4, mime_type=$5, size_bytes=$6, width=$7, height=$8, duration_seconds=$9
       where id = $1 returning ${COLS}`,
      [params.id, m.storage_path, m.public_url, m.file_name, m.mime_type, m.size_bytes, m.width, m.height, m.duration_seconds],
    )).rows[0];
    const updatedFields = await rewriteDraftUrls(c, old.public_url, m.public_url, m.width, m.height);
    const u = await usage(c, old.public_url);
    if (u.live) {
      // still on the live site: keep it tracked so it can be cleaned up after the next publish
      await c.query(
        `insert into public.media_assets (bucket, storage_path, public_url, file_name, mime_type, kind, size_bytes, width, height, duration_seconds, uploaded_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [old.bucket, old.storage_path, old.public_url, `${old.file_name} (versi lama)`, old.mime_type, old.kind, old.size_bytes, old.width, old.height, old.duration_seconds, old.uploaded_by],
      );
    }
    return { asset: updated, updatedFields, deleteOld: !u.live ? old.storage_path : null };
  });
  if (res.deleteOld) await deleteObject(res.deleteOld).catch((e) => console.error("[media] delete old failed", e));
  return { asset: res.asset, updatedFields: res.updatedFields };
});

/** Delete an asset — refused while it is referenced by draft or live content. */
export const DELETE = adminRoute<{ id: string }>(async ({ admin, params }) => {
  if (!UUID.test(params.id)) throw new HttpError(400, "Invalid id");
  const path = await asUser(admin.user_id, async (c) => {
    const a = (await c.query("select storage_path, public_url from public.media_assets where id = $1", [params.id])).rows[0];
    if (!a) throw new HttpError(404, "Media tidak ditemukan");
    const u = await usage(c, a.public_url);
    if (u.draft || u.live) throw new HttpError(409, "File masih dipakai di konten. Ganti dulu di section terkait.");
    await c.query("delete from public.media_assets where id = $1", [params.id]);
    return a.storage_path as string;
  });
  await deleteObject(path);
  return { deleted: true };
});
