import { randomBytes } from "node:crypto";
import { adminRoute, HttpError, readJson } from "@/lib/admin";
import { checkFile, storageKey } from "@/content/media-rules";
import { presignUpload } from "@/lib/storage";
import { STORAGE_CONFIGURED } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Step 1 of an upload: validate and hand out a short-lived presigned PUT URL. */
export const POST = adminRoute(async ({ req }) => {
  if (!STORAGE_CONFIGURED) throw new HttpError(503, "Object storage belum dikonfigurasi (lihat README).");
  const b = await readJson<{ fileName: string; contentType: string; size: number }>(req);
  const problem = checkFile(String(b.contentType ?? ""), Number(b.size ?? 0));
  if (problem) throw new HttpError(400, problem);
  const key = storageKey(String(b.fileName ?? "file"), b.contentType, randomBytes(4).toString("hex"));
  const { url, headers } = await presignUpload(key, b.contentType);
  return { key, uploadUrl: url, headers };
});
