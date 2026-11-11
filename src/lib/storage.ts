import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3 } from "./env";

/** Neon Object Storage (S3-compatible, path-style addressing only). */
let client: S3Client | null = null;
const s3 = () =>
  (client ??= new S3Client({
    region: S3.region,
    endpoint: S3.endpoint,
    credentials: { accessKeyId: S3.accessKeyId, secretAccessKey: S3.secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED", // required for presigned PUT (Neon docs)
  }));

export const CACHE_CONTROL = "public, max-age=31536000, immutable";

export const publicUrl = (key: string) =>
  `${S3.publicBase || `${S3.endpoint}/${S3.bucket}`}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** Presigned PUT so the browser uploads straight to storage (no Vercel body-size limit). */
export async function presignUpload(key: string, contentType: string) {
  const cmd = new PutObjectCommand({ Bucket: S3.bucket, Key: key, ContentType: contentType, CacheControl: CACHE_CONTROL });
  const url = await getSignedUrl(s3(), cmd, { expiresIn: 600, signableHeaders: new Set(["content-type", "cache-control"]) });
  return { url, headers: { "Content-Type": contentType, "Cache-Control": CACHE_CONTROL } };
}

export async function headObject(key: string) {
  const r = await s3().send(new HeadObjectCommand({ Bucket: S3.bucket, Key: key }));
  return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType ?? "" };
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: S3.bucket, Key: key }));
}
