/**
 * Analytics metric validation with known test events.
 *
 * Feeds hand-written tracker batches through the real server pipeline
 * (normalizeBatch → analytics_ingest as cms_app) into a TEST database, then checks every
 * dashboard metric against the expected value, plus dedup, session ownership, RLS and validation.
 *
 *   ANALYTICS_TEST_OWNER_URL=postgresql://owner@localhost/mil_analytics_test \
 *   ANALYTICS_TEST_APP_URL=postgresql://cms_app@localhost/mil_analytics_test \
 *   npm run test:analytics
 *
 * Refuses to run unless the database name contains "test" (it wipes analytics tables).
 */
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { normalizeBatch, PayloadError } from "../src/lib/analytics/ingest";
import { classifyChannel, isBot, parseUserAgent } from "../src/lib/analytics/classify";
import { heatmap, interactions, overview, parseFilters, todayInTz, traffic, video } from "../src/lib/analytics/queries";

const OWNER = process.env.ANALYTICS_TEST_OWNER_URL ?? "";
const APP = process.env.ANALYTICS_TEST_APP_URL ?? "";
if (!OWNER || !APP) throw new Error("Set ANALYTICS_TEST_OWNER_URL and ANALYTICS_TEST_APP_URL");
for (const u of [OWNER, APP]) if (!/test/i.test(new URL(u).pathname)) throw new Error("Refusing: database name must contain 'test'");

let failed = 0, passed = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = typeof expected === "number" && typeof actual === "number" ? Math.abs(actual - expected) < 1e-6 : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}${ok ? "" : `  — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const TABLET_UA = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

async function main() {
  const owner = new Client({ connectionString: OWNER });
  const app = new Client({ connectionString: APP });
  await owner.connect();
  await app.connect();

  // --- fixtures -------------------------------------------------------------------------------
  await owner.query(`truncate public.analytics_video_events, public.analytics_video_views, public.analytics_events,
    public.analytics_pageviews, public.analytics_sessions, public.analytics_visitors, public.analytics_elements`);
  const adminId = "test-admin-" + randomUUID().slice(0, 8);
  const userId = "test-user-" + randomUUID().slice(0, 8);
  await owner.query(`insert into "user" (id, name, email, "emailVerified") values ($1,'Admin',$2,true), ($3,'User',$4,true)`,
    [adminId, `${adminId}@test.local`, userId, `${userId}@test.local`]);
  await owner.query(`insert into public.admin_users (user_id, email, role) values ($1, $2, 'owner')`, [adminId, `${adminId}@test.local`]);

  const now = Date.now();
  const ingest = async (body: Record<string, unknown>, ua = DESKTOP_UA, geo: { country?: string; city?: string } = {}) => {
    const n = normalizeBatch({ sentAt: Date.now(), ...body }, { ua, host: "www.mildigital.id", now: Date.now(), ...geo });
    await app.query("select public.analytics_ingest($1::jsonb)", [JSON.stringify(n)]);
    return n;
  };
  const pvBase = (id: string, extra: Record<string, unknown> = {}) => ({ id, path: "/", start: now - 60_000, layout: "t1-test", vw: 1440, vh: 900, dh: 6000, bucket: "desktop", ...extra });

  const A = randomUUID(), B = randomUUID(), C = randomUUID();
  const A1 = randomUUID(), A2 = randomUUID(), B1 = randomUUID(), C1 = randomUUID();
  const pA1 = randomUUID(), pA2a = randomUUID(), pA2b = randomUUID(), pB1 = randomUUID(), pC1 = randomUUID();

  // Visitor A, session 1: direct, 5 s, no interaction → bounce
  await ingest({ s: { id: A1, vid: A, start: now - 50 * 60_000, ret: 0 }, pv: pvBase(pA1, { start: now - 50 * 60_000, act: 5000, scr: 20, sec: { hero: 5000 } }),
    ev: [{ q: 1, t: now - 50 * 60_000, k: "exposure", e: "hero.cta", s: "hero" }],
    el: [{ id: "hero.cta", label: "Hero — Let's Talk (CTA)", section: "hero", kind: "cta" }] });

  // Visitor A, session 2: returning, Facebook paid campaign, 2 page views (refresh), 2 CTA clicks, 1 hover
  const utm = { source: "facebook", medium: "cpc", campaign: "launch", content: "video-a", term: "agency" };
  await ingest({ s: { id: A2, vid: A, start: now - 20 * 60_000, ret: 1, utm, ref: "https://l.facebook.com/" },
    pv: pvBase(pA2a, { start: now - 20 * 60_000, act: 30_000, scr: 80, sec: { hero: 20_000, services: 10_000 } }),
    ev: [
      { q: 1, t: now - 19 * 60_000, k: "exposure", e: "hero.cta", s: "hero" },
      { q: 2, t: now - 19 * 60_000, k: "click", e: "hero.cta", s: "hero", rx: 0.5, ry: 0.5, sx: 0.2, sy: 0.7 },
      { q: 3, t: now - 19 * 60_000, k: "hover", e: "services.core-consulting", s: "services", v: 800 },
      { q: 4, t: now - 19 * 60_000, k: "click", s: "services", sx: 0.5, sy: 0.4 },
      { q: 5, t: now - 19 * 60_000, k: "scroll", v: 25 },
      { q: 6, t: now - 19 * 60_000, k: "scroll", v: 50 },
      { q: 7, t: now - 19 * 60_000, k: "scroll", v: 75 },
      { q: 8, t: now - 19 * 60_000, k: "hover", e: "services.core-consulting", v: 200 }, // < 500 ms still accepted by server; tracker filters
    ] });
  await ingest({ s: { id: A2, vid: A, start: now - 20 * 60_000, ret: 1, utm },
    pv: pvBase(pA2b, { start: now - 15 * 60_000, act: 10_000, scr: 40 }),
    ev: [{ q: 1, t: now - 15 * 60_000, k: "click", e: "hero.cta", s: "hero", rx: 0.4, ry: 0.6 }] });

  // Visitor B, mobile, Google organic: floating WhatsApp click, video 1 watched 3.5 s
  await ingest({ s: { id: B1, vid: B, start: now - 10 * 60_000, ret: 0, ref: "https://www.google.com/search?q=secret" },
    pv: pvBase(pB1, { start: now - 10 * 60_000, vw: 390, vh: 844, bucket: "mobile", act: 40_000, scr: 100, sec: { hero: 10_000, testimonials: 20_000, footer: 1000 } }),
    ev: [
      { q: 1, t: now - 9 * 60_000, k: "exposure", e: "whatsapp.float" },
      { q: 2, t: now - 9 * 60_000, k: "click", e: "whatsapp.float", rx: 0.5, ry: 0.5, f: 1 },
      { q: 3, t: now - 9 * 60_000, k: "exposure", e: "hero.cta", s: "hero" },
    ],
    vd: [{ id: "testimonial-1", ft: now - 9 * 60_000, imp: 1, pl: 1, w: 3500, fu: 3500, d: 30_000, c: 0 }],
    ve: [{ q: 4, t: now - 9 * 60_000, id: "testimonial-1", k: "play", p: 0 }, { q: 5, t: now - 9 * 60_000, id: "testimonial-1", k: "m3s", p: 3000 },
         { q: 6, t: now - 9 * 60_000, id: "testimonial-1", k: "exit", p: 3500 }] }, MOBILE_UA, { country: "ID", city: "Jakarta" });

  // Visitor C, tablet, referral: video 1 watched 16 s (ThruPlay, 50%), video 2 (10 s) completed; video 3 seen, not played
  const batchC = { s: { id: C1, vid: C, start: now - 5 * 60_000, ret: 0, ref: "https://blog.example.com/post?id=1" },
    pv: pvBase(pC1, { start: now - 5 * 60_000, vw: 820, vh: 1180, bucket: "tablet", act: 60_000, scr: 60 }),
    vd: [
      { id: "testimonial-1", ft: now - 4 * 60_000, imp: 1, pl: 1, w: 16_000, fu: 16_000, d: 30_000, c: 0 },
      { id: "testimonial-2", ft: now - 4 * 60_000, imp: 1, pl: 2, w: 12_000, fu: 10_000, d: 10_000, c: 1 },
      { id: "testimonial-3", ft: now - 4 * 60_000, imp: 1, pl: 0, w: 0, fu: 0, d: 20_000, c: 0 },
    ],
    ve: [{ q: 1, t: now - 4 * 60_000, id: "testimonial-1", k: "play", p: 0 }, { q: 2, t: now - 4 * 60_000, id: "testimonial-1", k: "pause", p: 16000 },
         { q: 3, t: now - 4 * 60_000, id: "testimonial-2", k: "complete", p: 10000 }] };
  await ingest(batchC, TABLET_UA);
  // Retry of the exact same batch (network retry) must not double count
  await ingest(batchC, TABLET_UA);
  // Out-of-order older snapshot must not lower cumulative values
  await ingest({ ...batchC, vd: [{ id: "testimonial-1", ft: now - 4 * 60_000, imp: 1, pl: 1, w: 2000, fu: 2000, d: 30_000, c: 0 }], ve: [] }, TABLET_UA);

  // Hijack attempt: another visitor id re-using session A1 → ignored
  const D = randomUUID();
  await ingest({ s: { id: A1, vid: D, start: now - 5000, ret: 0 }, pv: pvBase(randomUUID(), { act: 1000 }),
    ev: [{ q: 1, t: now - 1000, k: "click", e: "hero.cta", rx: 0.5, ry: 0.5 }] });

  // --- metrics as an admin -------------------------------------------------------------------
  console.log("\nMetrics (expected values derived by hand from the batches above)");
  await app.query("begin");
  await app.query("select set_config('app.user_id', $1, true)", [adminId]);
  // yesterday..today so the test also passes right after midnight (fixtures go back 50 minutes)
  const today = todayInTz();
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
  const f = parseFilters(new URLSearchParams(`range=custom&from=${yesterday}&to=${today}&granularity=day`));
  const o = await overview(app as never, f);
  const cur = o.current;
  eq("sessions", cur.sessions, 4);
  eq("unique visitors", cur.uniqueVisitors, 3);
  eq("total visitors (visitor-days)", cur.totalVisitors, 3);
  eq("page views", cur.pageviews, 5);
  eq("pages / session", cur.pagesPerSession, 5 / 4);
  eq("avg session duration (ms)", cur.avgSessionMs, (5000 + 40_000 + 40_000 + 60_000) / 4);
  eq("bounce rate (A1 only: <10 s, 1 page, no click)", cur.bounceRate, 1 / 4);
  eq("new visitors", cur.newVisitors, 3);
  eq("returning visitors", cur.returningVisitors, 1);
  eq("CTA clicks (cta + whatsapp kinds)", cur.ctaClicks, 2); // whatsapp.float has no element row with kind → not counted, see next
  eq("element clicks", cur.elementClicks, 3);
  eq("overall click rate (sessions with click / sessions)", cur.clickRate, 2 / 4);
  eq("video plays", cur.videoPlays, 1 + 1 + 2);
  eq("3-second plays", cur.video3s, 3);
  eq("ThruPlays (≥15 s or complete <15 s)", cur.thruplays, 2);
  eq("previous period sessions", o.previous.sessions, 0);

  const t = await traffic(app as never, f);
  const ch = Object.fromEntries(t.channels.map((x: { channel: string; sessions: number }) => [x.channel, x.sessions]));
  eq("channels", ch, { direct: 1, organic: 1, paid: 1, referral: 1 });
  eq("referrer stored without query string", t.referrers.find((r: { domain: string }) => r.domain === "google.com")?.example, "https://www.google.com/search");
  eq("UTM campaign kept for the whole session", t.campaigns[0] && [t.campaigns[0].utm_source, t.campaigns[0].utm_campaign, t.campaigns[0].utm_content, t.campaigns[0].utm_term, t.campaigns[0].sessions], ["facebook", "launch", "video-a", "agency", 1]);
  eq("devices", Object.fromEntries(t.devices.map((x: { name: string; sessions: number }) => [x.name, x.sessions])), { desktop: 2, mobile: 1, tablet: 1 });
  eq("geo city", t.cities.find((x: { name: string }) => x.name === "Jakarta")?.country, "ID");
  const page = t.pages[0];
  eq("top page '/' page views", page.pageviews, 5);
  eq("top page '/' entrances", page.entrances, 4);
  eq("top page '/' bounce rate", page.bounce_rate, 1 / 4);
  eq("top page '/' exit rate (4 exits / 5 views)", page.exit_rate, 4 / 5);
  const hero = t.sections.find((x: { section: string }) => x.section === "hero");
  eq("section 'hero' reached in 3 page views", hero?.reached, 3);

  const i = await interactions(app as never, f);
  const cta = i.elements.find((e: { id: string }) => e.id === "hero.cta")!;
  eq("hero.cta clicks", cta.clicks, 2);
  eq("hero.cta unique clicks (sessions)", cta.click_sessions, 1);
  eq("hero.cta exposed sessions", cta.exposed_sessions, 3);
  eq("hero.cta CTR = 1 / 3", cta.ctr, 1 / 3);
  eq("hero.cta clicks by device", [cta.clicks_desktop, cta.clicks_mobile, cta.clicks_tablet], [2, 0, 0]);
  const card = i.elements.find((e: { id: string }) => e.id === "services.core-consulting")!;
  eq("hover events", card.hovers, 2);
  eq("avg hover duration", card.avg_hover_ms, 500);
  const wa = i.elements.find((e: { id: string }) => e.id === "whatsapp.float")!;
  eq("whatsapp CTR = 1/1", wa.ctr, 1);

  const h = await heatmap(app as never, f, "desktop", "");
  eq("desktop heatmap page views", h.counts.pageviews, 3);
  eq("desktop heatmap clicks (2 element + 1 free)", h.counts.clicks, 3);
  eq("element-anchored click buckets", h.elementClicks.length, 2);
  eq("free click anchored to section", h.freeClicks[0] && [h.freeClicks[0].section, Number(h.freeClicks[0].sx), Number(h.freeClicks[0].sy)], ["services", 0.5, 0.4]);
  const s50 = h.scroll.find((x: { depth: number }) => x.depth === 50);
  eq("desktop scroll: 1 of 3 page views reached 50%", s50?.reached, 1);
  const hm = await heatmap(app as never, f, "mobile", "");
  eq("mobile: fixed element listed separately", hm.fixedClicks.map((x: { element: string; n: number }) => [x.element, x.n]), [["whatsapp.float", 1]]);
  const hl = await heatmap(app as never, f, "desktop", "other-layout");
  eq("layout filter excludes other layouts", hl.counts.pageviews, 0);

  const v = await video(app as never, f);
  const v1 = v.videos.find((x: { id: string }) => x.id === "testimonial-1")!;
  const v2 = v.videos.find((x: { id: string }) => x.id === "testimonial-2")!;
  const v3 = v.videos.find((x: { id: string }) => x.id === "testimonial-3")!;
  eq("v1 impressions", v1.impressions, 2);
  eq("v1 unique plays", v1.unique_plays, 2);
  eq("v1 3-second plays", v1.plays_3s, 2);
  eq("v1 ThruPlays (16 s ≥ 15 s; 3.5 s not)", v1.thruplays, 1);
  eq("v1 50% views (16 s of 30 s)", v1.p50, 1);
  eq("v1 cumulative values not lowered by older snapshot", v1.avg_watch_ms, (3500 + 16000) / 2);
  eq("v1 3-second view rate = 2 / 2 impressions", v1.rate3s, 1);
  eq("v1 completion rate", v1.completionRate, 0);
  eq("v1 pause / exit events", [v1.pauses, v1.exits], [1, 1]);
  eq("v2 total plays (incl. replay)", v2.plays, 2);
  eq("v2 ThruPlay: shorter than 15 s and completed", v2.thruplays, 1);
  eq("v2 completion rate = 1 / 1", v2.completionRate, 1);
  eq("v2 retention 100%", v2.retention.at(-1)?.pct, 1);
  eq("v3 impression without play → play rate 0", [v3.impressions, v3.playRate], [1, 0]);
  await app.query("commit");

  // --- security -------------------------------------------------------------------------------
  console.log("\nSecurity");
  const anon = await app.query("select count(*)::int n from public.analytics_sessions");
  eq("cms_app without user: RLS returns 0 rows", anon.rows[0].n, 0);
  await app.query("begin");
  await app.query("select set_config('app.user_id', $1, true)", [userId]);
  eq("non-admin user: 0 rows", (await app.query("select count(*)::int n from public.analytics_events")).rows[0].n, 0);
  let denied = false;
  try { await app.query("select public.analytics_purge('all')"); } catch { denied = true; }
  eq("non-admin cannot delete everything", denied, true);
  await app.query("rollback");
  denied = false;
  try { await app.query("insert into public.analytics_sessions (id, visitor_id, started_at, last_seen_at) values (gen_random_uuid(), gen_random_uuid(), now(), now())"); } catch { denied = true; }
  eq("cms_app cannot insert directly (only via analytics_ingest)", denied, true);
  denied = false;
  try { await app.query("select public.analytics_purge('older_than', 5)"); } catch { denied = true; }
  eq("retention below 30 days is refused", denied, true);
  const owned = await owner.query("select count(*)::int n from public.analytics_pageviews where session_id = $1", [A1]);
  eq("session hijack ignored (A1 still has 1 page view)", owned.rows[0].n, 1);

  // --- validation / classification ------------------------------------------------------------
  console.log("\nValidation & classification");
  const bad = (body: Record<string, unknown>) => { try { normalizeBatch(body, { ua: DESKTOP_UA, host: "x", now }); return false; } catch (e) { return e instanceof PayloadError; } };
  eq("rejects invalid session id", bad({ s: { id: "x", vid: A }, pv: { id: randomUUID() } }), true);
  eq("rejects missing page view id", bad({ s: { id: randomUUID(), vid: A }, pv: {} }), true);
  const n = normalizeBatch({ sentAt: now - 3_600_000, s: { id: randomUUID(), vid: A, start: now - 3_600_000 }, pv: { id: randomUUID(), path: "/?email=a@b.c#x", start: now - 3_600_000 },
    ev: [{ q: 1, t: now - 3_600_000, k: "keypress" }, { q: 2, t: now - 3_600_000, k: "click", e: "<script>" }, { q: 3, t: now - 3_600_000, k: "hover", v: 99_999, e: "a.b" }, { q: 4, t: now - 3_600_000, k: "scroll", v: 33 }] },
    { ua: DESKTOP_UA, host: "x", now });
  eq("query string never stored", n.pageview.path, "/");
  eq("unknown event types / bad ids / invalid scroll milestones dropped", n.events.map((e) => [e.type, e.element]), [["click", null], ["hover", "a.b"]]);
  eq("hover capped at 30 s", n.events[1].value, 30_000);
  eq("clock skew corrected (client clock 1 h behind)", Math.abs(Date.parse(n.events[0].ts) - now) < 5000, true);
  eq("bot UA detected", [isBot("Googlebot/2.1"), isBot("Mozilla/5.0 HeadlessChrome/120"), isBot(DESKTOP_UA)], [true, true, false]);
  eq("UA parsing", [parseUserAgent(MOBILE_UA).device, parseUserAgent(TABLET_UA).device, parseUserAgent(DESKTOP_UA).os], ["mobile", "tablet", "macOS"]);
  eq("channel: utm email", classifyChannel({ utmMedium: "email" }), "email");
  eq("channel: gclid", classifyChannel({ paidClickId: true, referrerDomain: "google.com" }), "paid");
  eq("channel: instagram referrer", classifyChannel({ referrerDomain: "l.instagram.com" }), "social");
  eq("channel: bing", classifyChannel({ referrerDomain: "bing.com" }), "organic");

  await owner.query(`delete from "user" where id in ($1, $2)`, [adminId, userId]);
  await owner.end();
  await app.end();
  console.log(`\n${failed ? "❌" : "✅"} ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
