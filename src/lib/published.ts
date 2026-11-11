import { unstable_cache } from "next/cache";
import { pool } from "./db";
import { DB_CONFIGURED } from "./env";
import { resolveContent } from "@/content/resolve";
import type { SiteContent } from "@/content/types";

export const CONTENT_TAG = "site-content";

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms))]);

const fetchPublished = unstable_cache(
  async (): Promise<SiteContent> => {
    const { rows } = await withTimeout(pool.query("select public.get_published_content() as c"), 15000);
    const data = rows[0]?.c;
    if (!data || typeof data !== "object" || !Object.keys(data).length) throw new Error("empty published content");
    return data as SiteContent;
  },
  ["published-content-v1"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

// Last successfully loaded content in this server instance (survives a DB outage).
let lastGood: SiteContent | null = null;

/**
 * Published content for the public site.
 * Order of preference: cached DB content -> last good copy in memory -> built-in original content.
 * Never throws, so the site can never go blank.
 */
export async function getPublishedContent(): Promise<{ content: SiteContent; fallback: boolean }> {
  if (DB_CONFIGURED) {
    try {
      const data = await fetchPublished();
      lastGood = data;
      return { content: resolveContent(data), fallback: false };
    } catch (e) {
      const err = e as Error & { code?: string };
      console.error("[cms] published content unavailable, using fallback:", err.message || err.code || String(e));
    }
  }
  return { content: resolveContent(lastGood), fallback: !lastGood };
}
