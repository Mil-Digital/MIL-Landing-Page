import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { verifyUploaded, type RegisterBody } from "@/lib/media-server";

export const dynamic = "force-dynamic";

const COLS = "id, storage_path, public_url, file_name, mime_type, kind, size_bytes, width, height, duration_seconds, alt_text, created_at, updated_at";

export const GET = adminRoute(async ({ req, admin }) => {
  const kind = new URL(req.url).searchParams.get("kind");
  const { rows } = await asUser(admin.user_id, (c) =>
    kind ? c.query(`select ${COLS} from public.media_assets where kind = $1 order by created_at desc`, [kind])
         : c.query(`select ${COLS} from public.media_assets order by created_at desc`),
  );
  return { assets: rows };
});

/** Step 2 of an upload: register the uploaded file in the media library. */
export const POST = adminRoute(async ({ req, admin }) => {
  const m = await verifyUploaded(await readJson<RegisterBody>(req));
  const { rows } = await asUser(admin.user_id, (c) =>
    c.query(
      `insert into public.media_assets (bucket, storage_path, public_url, file_name, mime_type, kind, size_bytes, width, height, duration_seconds, uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning ${COLS}`,
      [m.bucket, m.storage_path, m.public_url, m.file_name, m.mime_type, m.kind, m.size_bytes, m.width, m.height, m.duration_seconds, admin.user_id],
    ),
  );
  return { asset: rows[0] };
});
