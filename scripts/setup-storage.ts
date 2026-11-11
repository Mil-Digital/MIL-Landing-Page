/**
 * Configure CORS on the Neon Object Storage bucket so the CMS can upload straight from the
 * browser (presigned PUT). Run once after creating the bucket, and again when domains change.
 *
 *   npm run storage:cors -- https://www.mildigital.id https://mil-cms.vercel.app
 *
 * Without arguments it uses SITE_URL and http://localhost:3000.
 */
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const { AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, SITE_URL } = process.env;
if (!AWS_ENDPOINT_URL_S3 || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET) {
  console.error("Missing AWS_ENDPOINT_URL_S3 / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET in .env.local");
  process.exit(1);
}
const origins = process.argv.slice(2).length ? process.argv.slice(2) : [SITE_URL, "http://localhost:3000"].filter(Boolean) as string[];

const s3 = new S3Client({
  region: AWS_REGION || "ap-southeast-1",
  endpoint: AWS_ENDPOINT_URL_S3,
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
});

(async () => {
  await s3.send(new PutBucketCorsCommand({
    Bucket: S3_BUCKET,
    CORSConfiguration: {
      CORSRules: [
        { AllowedOrigins: origins.map((o) => o.replace(/\/$/, "")), AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
        { AllowedOrigins: ["*"], AllowedMethods: ["GET", "HEAD"], AllowedHeaders: ["*"], MaxAgeSeconds: 86400 },
      ],
    },
  }));
  const r = await s3.send(new GetBucketCorsCommand({ Bucket: S3_BUCKET }));
  console.log("✅ CORS bucket", S3_BUCKET, "→", JSON.stringify(r.CORSRules?.map((x) => ({ origins: x.AllowedOrigins, methods: x.AllowedMethods }))));
})().catch((e) => { console.error("❌", e.name, e.message); process.exit(1); });
