import { adminRoute, HttpError } from "@/lib/admin";
import { asUser } from "@/lib/db";
import { getPublishedContent } from "@/lib/published";
import { layoutVersion } from "@/site/render";
import { plain } from "@/site/format";
import { ANALYTICS, HEATMAP_MIN_SAMPLE, HOVER_MIN_MS, SESSION_TIMEOUT_MIN } from "@/lib/analytics/config";
import { heatmap, interactions, overview, parseFilters, traffic, video } from "@/lib/analytics/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/analytics?view=overview|traffic|interactions|heatmap|video
 *   &range=today|yesterday|7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 *   &granularity=auto|hour|day|week|month&device=&channel=
 *   heatmap: &bucket=desktop|tablet|mobile&layout=<id>|current|all
 */
export const GET = adminRoute(async ({ req, admin }) => {
  const sp = new URL(req.url).searchParams;
  const view = sp.get("view") ?? "overview";
  const f = parseFilters(sp);
  const { content } = await getPublishedContent();
  const currentLayout = layoutVersion(content);

  const data = await asUser(admin.user_id, async (c) => {
    switch (view) {
      case "overview":
        return overview(c, f);
      case "traffic":
        return traffic(c, f);
      case "interactions":
        return interactions(c, f);
      case "heatmap": {
        const l = sp.get("layout") ?? "current";
        const layout = l === "all" ? "" : l === "current" ? currentLayout : l.slice(0, 40);
        return heatmap(c, f, sp.get("bucket") ?? "desktop", layout);
      }
      case "video": {
        const items = ((content.testimonials as { items?: { caption?: string; kind?: string }[] })?.items ?? []);
        const labels: Record<string, string> = {};
        items.forEach((t, i) => (labels[`testimonial-${i + 1}`] = `Testimonial ${i + 1}${t.caption ? ` — ${plain(t.caption)}` : ""}`));
        return { ...(await video(c, f)), labels };
      }
      default:
        throw new HttpError(400, "Unknown view");
    }
  });

  return {
    view,
    filters: { range: f.range, from: f.from, to: f.to, device: f.device, channel: f.channel, granularity: f.granularity, prev: f.prev },
    meta: {
      timezone: ANALYTICS.timezone,
      consentMode: ANALYTICS.consentMode,
      enabled: ANALYTICS.enabled,
      retentionDays: ANALYTICS.retentionDays,
      sessionTimeoutMin: SESSION_TIMEOUT_MIN,
      hoverMinMs: HOVER_MIN_MS,
      heatmapMinSample: HEATMAP_MIN_SAMPLE,
      currentLayout,
      role: admin.role,
    },
    data,
  };
});
