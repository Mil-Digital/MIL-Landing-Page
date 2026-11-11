/**
 * Server-side configuration (never exposed to the browser: no NEXT_PUBLIC_ prefix).
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? "";
export const DB_CONFIGURED = Boolean(DATABASE_URL);

export const S3 = {
  endpoint: (process.env.AWS_ENDPOINT_URL_S3 ?? "").replace(/\/$/, ""),
  region: process.env.AWS_REGION ?? "ap-southeast-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  bucket: process.env.S3_BUCKET ?? "",
  /** Optional: public base URL for objects (defaults to `${endpoint}/${bucket}`). */
  publicBase: (process.env.S3_PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
};
export const STORAGE_CONFIGURED = Boolean(S3.endpoint && S3.accessKeyId && S3.secretAccessKey && S3.bucket);

/** Canonical origin of the public site (for canonical / og:image). */
export const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")
).replace(/\/$/, "");
