import { SITE_URL } from "@/lib/env";
export const dynamic = "force-static";
export function GET() {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ""}`;
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
