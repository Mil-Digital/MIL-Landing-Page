import { SITE_URL } from "@/lib/env";
export const dynamic = "force-static";
export function GET() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL || ""}/</loc></url></urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
