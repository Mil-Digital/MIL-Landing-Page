/**
 * Validation + normalisation of tracker batches (POST /api/collect).
 * Everything coming from the browser is untrusted: unknown keys are dropped, strings are
 * length-limited and pattern-checked, numbers clamped, timestamps corrected for clock skew.
 */
import { classifyChannel, parseUserAgent } from "./classify";

export class PayloadError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const EVENT_TYPES = new Set(["click", "hover", "exposure", "scroll"]);
const VIDEO_EVENT_TYPES = new Set(["play", "pause", "resume", "seek", "complete", "exit", "m3s", "m10s", "thruplay", "p25", "p50", "p75", "p95"]);
const BUCKETS = new Set(["desktop", "tablet", "mobile"]);

export const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS = 150;
const MAX_ELEMENTS = 60;
const MAX_VIDEOS = 20;
const MAX_AGE_MS = 24 * 3600_000; // queued events older than a day are dropped

type Any = Record<string, unknown>;

const uuid = (v: unknown, name: string) => {
  if (typeof v !== "string" || !UUID.test(v)) throw new PayloadError(`invalid ${name}`);
  return v.toLowerCase();
};
const id = (v: unknown): string | null => (typeof v === "string" && ID.test(v) ? v : null);
const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
};
const int = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(Math.min(max, Math.max(min, n))) : null;
};
const frac = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(Math.min(1.5, Math.max(-0.5, n)) * 10000) / 10000 : null;
};

/** Only keep the path (no query string / hash: they may contain personal data). */
const cleanPath = (v: unknown) => {
  const s = typeof v === "string" ? v : "/";
  const p = s.split(/[?#]/)[0].slice(0, 200);
  return p.startsWith("/") ? p : "/";
};

/** Referrer without query string; domain without "www.". Same-site referrers are ignored. */
function cleanReferrer(v: unknown, host: string): { referrer: string | null; domain: string | null } {
  if (typeof v !== "string" || !v) return { referrer: null, domain: null };
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol)) return { referrer: null, domain: null };
    const domain = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host && domain === host.replace(/^www\./, "").toLowerCase()) return { referrer: null, domain: null };
    return { referrer: `${u.protocol}//${u.hostname}${u.pathname}`.slice(0, 300), domain };
  } catch {
    return { referrer: null, domain: null };
  }
}

export type IngestContext = {
  ua: string;
  host: string;
  now: number;
  country?: string | null;
  region?: string | null;
  city?: string | null;
};

export function normalizeBatch(body: Any, ctx: IngestContext) {
  if (!body || typeof body !== "object") throw new PayloadError("invalid body");
  const s = (body.s ?? {}) as Any;
  const pv = (body.pv ?? {}) as Any;

  // Clock skew: the browser clock may be wrong. Shift every timestamp by (server now − client sentAt).
  const sentAt = typeof body.sentAt === "number" ? body.sentAt : ctx.now;
  const skew = Math.abs(ctx.now - sentAt) > 5000 ? ctx.now - sentAt : 0;
  const ts = (v: unknown): number | null => {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const t = v + skew;
    if (t > ctx.now + 60_000 || t < ctx.now - MAX_AGE_MS) return null;
    return t;
  };
  const iso = (t: number) => new Date(t).toISOString();

  const sessionStart = ts(s.start) ?? ctx.now;
  const pvStart = ts(pv.start) ?? ctx.now;
  const vw = int(pv.vw, 200, 8000);
  const utm = (s.utm ?? {}) as Any;
  const utmSource = str(utm.source, 100);
  const utmMedium = str(utm.medium, 100);
  const ref = cleanReferrer(s.ref, ctx.host);
  const ua = parseUserAgent(ctx.ua, vw ?? undefined);
  const bucket = typeof pv.bucket === "string" && BUCKETS.has(pv.bucket) ? pv.bucket : "desktop";

  const session = {
    id: uuid(s.id, "session id"),
    visitor_id: uuid(s.vid, "visitor id"),
    started_at: iso(Math.min(sessionStart, pvStart)),
    returning: s.ret === 1 || s.ret === true,
    referrer: ref.referrer,
    referrer_domain: ref.domain,
    channel: classifyChannel({ referrerDomain: ref.domain, utmSource, utmMedium, paidClickId: s.pclid === 1 || s.pclid === true }),
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: str(utm.campaign, 150),
    utm_content: str(utm.content, 150),
    utm_term: str(utm.term, 150),
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    country: str(ctx.country, 2)?.toUpperCase() ?? null,
    region: str(ctx.region, 80),
    city: str(ctx.city, 80),
  };

  const sections: Record<string, number> = {};
  if (pv.sec && typeof pv.sec === "object") {
    for (const [k, v] of Object.entries(pv.sec as Any).slice(0, 30)) {
      const n = int(v, 0, 6 * 3600_000);
      if (id(k) && n !== null) sections[k] = n;
    }
  }

  const pageview = {
    id: uuid(pv.id, "pageview id"),
    path: cleanPath(pv.path),
    started_at: iso(pvStart),
    layout: str(pv.layout, 40),
    bucket,
    vw,
    vh: int(pv.vh, 200, 8000),
    doc_h: int(pv.dh, 200, 100_000),
    active_ms: int(pv.act, 0, 6 * 3600_000) ?? 0,
    max_scroll: int(pv.scr, 0, 100) ?? 0,
    sections,
  };

  const elements = (Array.isArray(body.el) ? body.el : []).slice(0, MAX_ELEMENTS).flatMap((e: Any) => {
    const eid = id(e?.id);
    const label = str(e?.label, 120);
    return eid && label ? [{ id: eid, label, section: id(e.section), kind: id(e.kind) }] : [];
  });

  const events = (Array.isArray(body.ev) ? body.ev : []).slice(0, MAX_EVENTS).flatMap((e: Any) => {
    const t = ts(e?.t);
    const seq = int(e?.q, 0, 1_000_000);
    const type = typeof e?.k === "string" && EVENT_TYPES.has(e.k) ? e.k : null;
    if (t === null || seq === null || !type) return [];
    const element = id(e.e);
    if ((type === "hover" || type === "exposure") && !element) return [];
    let value = int(e.v, 0, 600_000);
    if (type === "hover") value = Math.min(value ?? 0, 30_000);
    if (type === "scroll" && ![25, 50, 75, 90, 100].includes(value ?? -1)) return [];
    return [{
      seq, ts: iso(t), type, element, section: id(e.s),
      rx: frac(e.rx), ry: frac(e.ry), sx: frac(e.sx), sy: frac(e.sy),
      fixed: e.f === 1 || e.f === true, value,
    }];
  });

  const videos = (Array.isArray(body.vd) ? body.vd : []).slice(0, MAX_VIDEOS).flatMap((v: Any) => {
    const vid = id(v?.id);
    if (!vid) return [];
    const duration = int(v.d, 0, 6 * 3600_000) ?? 0;
    const cap = duration > 0 ? duration : 6 * 3600_000;
    return [{
      video: vid,
      first_ts: iso(ts(v.ft) ?? ctx.now),
      impression: v.imp === 1 || v.imp === true,
      plays: int(v.pl, 0, 500) ?? 0,
      // watched time can exceed the duration (replays), but not absurdly
      watched_ms: int(v.w, 0, Math.min(cap * 20, 6 * 3600_000)) ?? 0,
      furthest_ms: int(v.fu, 0, cap) ?? 0,
      duration_ms: duration,
      completed: v.c === 1 || v.c === true,
    }];
  });

  const videoEvents = (Array.isArray(body.ve) ? body.ve : []).slice(0, MAX_EVENTS).flatMap((e: Any) => {
    const t = ts(e?.t);
    const seq = int(e?.q, 0, 1_000_000);
    const video = id(e?.id);
    const type = typeof e?.k === "string" && VIDEO_EVENT_TYPES.has(e.k) ? e.k : null;
    if (t === null || seq === null || !video || !type) return [];
    return [{ seq, ts: iso(t), video, type, position_ms: int(e.p, 0, 6 * 3600_000) }];
  });

  return { session, pageview, elements, events, videos, video_events: videoEvents };
}
