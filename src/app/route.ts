import { getPublishedContent } from "@/lib/published";
import { renderPage } from "@/site/render";
import { SITE_URL } from "@/lib/env";

/**
 * Public landing page.
 * Statically generated + cached on Vercel's CDN (ISR). On "Publish" the CMS calls
 * revalidateTag/revalidatePath, so new content is live on the next request – no redeploy.
 * The 5-minute window is only a safety net (e.g. to recover after a database outage).
 */
export const revalidate = 300;

export async function GET() {
  const { content, fallback } = await getPublishedContent();
  if (fallback && process.env.NEXT_PHASE !== "phase-production-build") {
    // Database unreachable during a background re-generation: throwing makes Next.js keep serving
    // the last successfully generated page (= last published content) instead of the original copy.
    throw new Error("CMS content unavailable — keeping the previously generated page");
  }
  const html = renderPage(content, { origin: SITE_URL || undefined, fallback });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
