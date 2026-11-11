import { createHash } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { pool } from "@/lib/db";
import { DB_CONFIGURED } from "@/lib/env";
import { ANALYTICS } from "@/lib/analytics/config";
import { isBot } from "@/lib/analytics/classify";
import { MAX_BODY_BYTES, normalizeBatch, PayloadError } from "@/lib/analytics/ingest";

/**
 * Public, anonymous analytics endpoint used by /mil-analytics.js.
 * - No credentials are exposed: the server validates the batch and calls the
 *   security-definer function analytics_ingest() as the restricted cms_app role.
 * - Drops: bots, admins (CMS session cookie), excluded IPs, cross-site posts, oversized bodies.
 * - Best-effort rate limit per IP (in memory, per server instance). For hard limits add a
 *   Vercel Firewall rate-limit rule on /api/collect (see docs/ANALYTICS.md).
 * Always answers 204/4xx quickly and never leaks details.
 */
export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 90; // batches per IP per minute (a normal visitor sends ~6)
const hits = new Map<string, { n: number; t: number }>();

function limited(key: string, now: number) {
  const h = hits.get(key);
  if (!h || now - h.t > WINDOW_MS) {
    hits.set(key, { n: 1, t: now });
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.t > WINDOW_MS) hits.delete(k);
    return false;
  }
  h.n++;
  return h.n > MAX_PER_WINDOW;
}

const noContent = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!ANALYTICS.enabled || !DB_CONFIGURED) return noContent();

  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;

  // Same-site only (sendBeacon / fetch from the landing page always send Origin on POST).
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return new Response(null, { status: 403 });
    } catch {
      return new Response(null, { status: 403 });
    }
  }

  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return noContent();
  // Signed-in CMS users are internal traffic.
  if (getSessionCookie(req.headers)) return noContent();

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  if (ANALYTICS.excludeIps.includes(ip)) return noContent();
  const now = Date.now();
  // IP is only used in memory, hashed, for rate limiting — never stored.
  if (limited(createHash("sha256").update(ip).digest("base64url").slice(0, 16), now)) {
    return new Response(null, { status: 429, headers: { "retry-after": "60" } });
  }

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let batch;
  try {
    batch = normalizeBatch(JSON.parse(text), {
      ua,
      host: host.split(":")[0],
      now,
      country: req.headers.get("x-vercel-ip-country"),
      region: req.headers.get("x-vercel-ip-country-region"),
      city: decodeHeader(req.headers.get("x-vercel-ip-city")),
    });
  } catch (e) {
    if (e instanceof PayloadError || e instanceof SyntaxError) return new Response(null, { status: 400 });
    throw e;
  }

  try {
    await pool.query("select public.analytics_ingest($1::jsonb)", [JSON.stringify(batch)]);
  } catch (e) {
    console.error("[analytics] ingest failed:", (e as Error).message);
    // 503 → the tracker keeps the batch and retries later.
    return new Response(null, { status: 503 });
  }
  return noContent();
}

/** Vercel encodes the city header (e.g. "S%C3%A3o%20Paulo"). */
function decodeHeader(v: string | null) {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}
