/**
 * Dashboard queries. Every query aggregates inside Postgres (indexes on started_at / session_id),
 * so the dashboard never downloads raw events. Runs as cms_app inside asUser() → RLS is_admin().
 *
 * Scope rule: everything is filtered by the SESSION start time (in ANALYTICS.timezone) and the
 * session's device / channel. Numerators and denominators of every rate therefore come from the
 * same set of sessions.
 */
import type { PoolClient } from "pg";
import { ANALYTICS } from "./config";

export type Granularity = "hour" | "day" | "week" | "month";
export type Filters = { from: string; to: string; device: string; channel: string; granularity: Granularity };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEVICES = ["", "desktop", "mobile", "tablet"];
const CHANNELS = ["", "direct", "organic", "social", "referral", "paid", "email", "other"];

/** Today's date (YYYY-MM-DD) in the analytics timezone. */
export function todayInTz(tz = ANALYTICS.timezone, d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const addDays = (date: string, n: number) => {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function parseFilters(sp: URLSearchParams): Filters & { range: string; prev: { from: string; to: string } } {
  const today = todayInTz();
  const range = sp.get("range") ?? "7d";
  let from = today, to = today;
  if (range === "yesterday") from = to = addDays(today, -1);
  else if (range === "7d") from = addDays(today, -6);
  else if (range === "30d") from = addDays(today, -29);
  else if (range === "90d") from = addDays(today, -89);
  else if (range === "custom") {
    const f = sp.get("from") ?? "", t = sp.get("to") ?? "";
    if (DATE.test(f) && DATE.test(t)) {
      from = f <= t ? f : t;
      to = f <= t ? t : f;
      if (daysBetween(from, to) > 730) from = addDays(to, -730);
    } else from = addDays(today, -6);
  }
  const span = daysBetween(from, to) + 1;
  let g = (sp.get("granularity") ?? "auto") as Granularity | "auto";
  if (!["hour", "day", "week", "month"].includes(g)) g = span <= 2 ? "hour" : span <= 45 ? "day" : span <= 180 ? "week" : "month";
  if (g === "hour" && span > 7) g = "day";
  const dev = sp.get("device") ?? "", chan = sp.get("channel") ?? "";
  const device = DEVICES.includes(dev) ? dev : "";
  const channel = CHANNELS.includes(chan) ? chan : "";
  return { range, from, to, device, channel, granularity: g as Granularity, prev: { from: addDays(from, -span), to: addDays(from, -1) } };
}

/* $1 from, $2 to, $3 tz, $4 device, $5 channel */
const SESSIONS = `
  select s.* from public.analytics_sessions s
  where s.started_at >= ($1::date)::timestamp at time zone $3
    and s.started_at <  ($2::date + 1)::timestamp at time zone $3
    and ($4 = '' or s.device = $4)
    and ($5 = '' or s.channel = $5)`;

const base = (f: { from: string; to: string; device: string; channel: string }) => [f.from, f.to, ANALYTICS.timezone, f.device, f.channel];
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

/* ------------------------------------------------------------------ overview */
async function summary(c: PoolClient, f: { from: string; to: string; device: string; channel: string }) {
  const r = await c.query(
    `with s as (${SESSIONS}),
     ev as (
       select e.session_id, e.type, e.element, el.kind
       from public.analytics_events e join s on s.id = e.session_id
       left join public.analytics_elements el on el.id = e.element
       where e.type in ('click','exposure') and e.element is not null),
     vv as (select v.* from public.analytics_video_views v join s on s.id = v.session_id)
     select
       (select count(*) from s)::int                                                  as sessions,
       (select count(distinct visitor_id) from s)::int                                as unique_visitors,
       (select count(*) from (select distinct visitor_id, (started_at at time zone $3)::date from s) x)::int as total_visitors,
       (select coalesce(sum(pageviews), 0) from s)::int                               as pageviews,
       (select coalesce(avg(duration_ms), 0) from s)::float8                          as avg_duration_ms,
       (select avg(case when engaged then 0 else 1 end) from s)::float8               as bounce_rate,
       (select count(distinct visitor_id) filter (where not is_returning) from s)::int as new_visitors,
       (select count(distinct visitor_id) filter (where is_returning) from s)::int    as returning_visitors,
       (select count(*) from ev where type = 'click' and kind in ('cta','whatsapp'))::int as cta_clicks,
       (select count(*) from ev where type = 'click')::int                            as element_clicks,
       (select count(distinct session_id) from ev where type = 'click')::int          as clicking_sessions,
       (select coalesce(sum(plays), 0) from vv)::int                                  as video_plays,
       (select count(*) from vv where watched_ms >= 3000)::int                        as video_3s,
       (select count(*) from vv where watched_ms >= 15000
                                   or (completed and duration_ms > 0 and duration_ms < 15000))::int as video_thruplays,
       (select max(last_seen_at) from s)                                              as last_activity`,
    base(f),
  );
  const x = r.rows[0];
  const sessions = num(x.sessions);
  return {
    sessions,
    uniqueVisitors: num(x.unique_visitors),
    totalVisitors: num(x.total_visitors),
    pageviews: num(x.pageviews),
    pagesPerSession: sessions ? num(x.pageviews) / sessions : 0,
    avgSessionMs: num(x.avg_duration_ms),
    bounceRate: x.bounce_rate === null ? null : num(x.bounce_rate),
    newVisitors: num(x.new_visitors),
    returningVisitors: num(x.returning_visitors),
    ctaClicks: num(x.cta_clicks),
    elementClicks: num(x.element_clicks),
    clickRate: sessions ? num(x.clicking_sessions) / sessions : null,
    videoPlays: num(x.video_plays),
    video3s: num(x.video_3s),
    thruplays: num(x.video_thruplays),
    lastActivity: x.last_activity as string | null,
  };
}

async function timeseries(c: PoolClient, f: Filters) {
  const r = await c.query(
    `with s as (${SESSIONS}),
     b as (select generate_series(date_trunc($6, ($1::date)::timestamp),
                                  ($2::date + 1)::timestamp - interval '1 second',
                                  ('1 ' || $6)::interval) as bucket)
     select to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI') as t,
            count(distinct s.visitor_id)::int as visitors,
            count(s.id)::int as sessions,
            coalesce(sum(s.pageviews), 0)::int as pageviews
     from b left join s on date_trunc($6, s.started_at at time zone $3) = b.bucket
     group by b.bucket order by b.bucket`,
    [...base(f), f.granularity],
  );
  return r.rows as { t: string; visitors: number; sessions: number; pageviews: number }[];
}

export async function overview(c: PoolClient, f: Filters & { prev: { from: string; to: string } }) {
  const [cur, prev, series, top] = [
    await summary(c, f),
    await summary(c, { ...f, ...f.prev }),
    await timeseries(c, f),
    await elementStats(c, f, 6),
  ];
  return { current: cur, previous: prev, series, topElements: top };
}

/* ------------------------------------------------------------------ traffic */
export async function traffic(c: PoolClient, f: Filters) {
  const q = (sql: string, extra: unknown[] = []) => c.query(`with s as (${SESSIONS}) ${sql}`, [...base(f), ...extra]).then((r) => r.rows);
  const channels = await q(`
    select channel, count(*)::int sessions, count(distinct visitor_id)::int visitors,
           avg(case when engaged then 0 else 1 end)::float8 bounce_rate, avg(duration_ms)::float8 avg_ms
    from s group by channel order by sessions desc`);
  const referrers = await q(`
    select referrer_domain as domain, channel, count(*)::int sessions, count(distinct visitor_id)::int visitors,
           (array_agg(referrer order by started_at desc))[1] as example
    from s where referrer_domain is not null group by referrer_domain, channel order by sessions desc limit 25`);
  const campaigns = await q(`
    select utm_source, utm_medium, utm_campaign, utm_content, utm_term, channel,
           count(*)::int sessions, count(distinct visitor_id)::int visitors,
           avg(case when engaged then 0 else 1 end)::float8 bounce_rate
    from s where coalesce(utm_source, utm_medium, utm_campaign, utm_content, utm_term) is not null
    group by 1,2,3,4,5,6 order by sessions desc limit 50`);
  const dim = (col: string, limit = 12) =>
    q(`select coalesce(${col}, 'Unknown') as name, count(*)::int sessions, count(distinct visitor_id)::int visitors
       from s group by 1 order by sessions desc limit ${limit}`);
  const countries = await dim("country", 15);
  const cities = await q(`
    select coalesce(city, 'Unknown') as name, country, count(*)::int sessions, count(distinct visitor_id)::int visitors
    from s group by 1, 2 order by sessions desc limit 15`);
  const devices = await dim("device");
  const browsers = await dim("browser");
  const os = await dim("os");
  const visitorTypes = await q(`
    select case when is_returning then 'returning' else 'new' end as name,
           count(*)::int sessions, count(distinct visitor_id)::int visitors
    from s group by 1`);
  const pages = await q(`
    , p as (
      select p.*, s.engaged,
             row_number() over (partition by p.session_id order by p.started_at)      as rn,
             row_number() over (partition by p.session_id order by p.started_at desc) as rn_desc
      from public.analytics_pageviews p join s on s.id = p.session_id)
    select path, count(*)::int pageviews, count(distinct visitor_id)::int visitors,
           avg(active_ms)::float8 avg_ms,
           count(*) filter (where rn = 1)::int entrances,
           (count(*) filter (where rn = 1 and not engaged))::float8 / nullif(count(*) filter (where rn = 1), 0) as bounce_rate,
           (count(*) filter (where rn_desc = 1))::float8 / nullif(count(*), 0) as exit_rate,
           avg(max_scroll)::float8 as avg_scroll
    from p group by path order by pageviews desc limit 30`);
  const sections = await q(`
    , p as (select p.id, p.sections from public.analytics_pageviews p join s on s.id = p.session_id)
    select k.key as section,
           count(*)::int reached,
           avg(k.value::int)::float8 avg_ms,
           (select count(*) from p)::int pageviews
    from p cross join lateral jsonb_each_text(p.sections) k
    where k.value::int > 0
    group by k.key`);
  return { channels, referrers, campaigns, countries, cities, devices, browsers, os, visitorTypes, pages, sections };
}

/* ------------------------------------------------------------------ clicks & hovers */
export async function elementStats(c: PoolClient, f: Filters, limit = 200) {
  const r = await c.query(
    `with s as (${SESSIONS}),
     e as (select e.session_id, e.type, e.element, e.value, s.device
           from public.analytics_events e join s on s.id = e.session_id
           where e.element is not null and e.type in ('click','hover','exposure'))
     select e.element as id, coalesce(el.label, e.element) as label, el.section, el.kind,
            count(*) filter (where type = 'exposure')::int                      as exposures,
            count(distinct session_id) filter (where type = 'exposure')::int    as exposed_sessions,
            count(*) filter (where type = 'click')::int                         as clicks,
            count(distinct session_id) filter (where type = 'click')::int       as click_sessions,
            count(*) filter (where type = 'hover')::int                         as hovers,
            count(distinct session_id) filter (where type = 'hover')::int       as hover_sessions,
            avg(value) filter (where type = 'hover')::float8                    as avg_hover_ms,
            count(distinct session_id) filter (where type in ('click','hover'))::int as engaged_sessions,
            count(*) filter (where type = 'click' and device = 'desktop')::int  as clicks_desktop,
            count(*) filter (where type = 'click' and device = 'mobile')::int   as clicks_mobile,
            count(*) filter (where type = 'click' and device = 'tablet')::int   as clicks_tablet
     from e left join public.analytics_elements el on el.id = e.element
     group by e.element, el.label, el.section, el.kind
     order by clicks desc, exposures desc
     limit ${Math.min(Math.max(1, limit), 500)}`,
    base(f),
  );
  return r.rows.map((x) => ({
    ...x,
    ctr: x.exposed_sessions ? x.click_sessions / x.exposed_sessions : null,
    engagement: x.exposed_sessions ? Math.min(1, x.engaged_sessions / x.exposed_sessions) : null,
  }));
}

export async function interactions(c: PoolClient, f: Filters) {
  const elements = await elementStats(c, f);
  const top = elements.filter((e) => e.clicks > 0).slice(0, 5).map((e) => e.id);
  const series = top.length
    ? (
        await c.query(
          `with s as (${SESSIONS}),
           b as (select generate_series(date_trunc($6, ($1::date)::timestamp),
                                        ($2::date + 1)::timestamp - interval '1 second', ('1 ' || $6)::interval) as bucket)
           select to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI') as t, el as element, count(e.id)::int as clicks
           from b cross join unnest($7::text[]) el
           left join (select e.id, e.element, e.ts from public.analytics_events e join s on s.id = e.session_id where e.type = 'click') e
             on e.element = el and date_trunc($6, e.ts at time zone $3) = b.bucket
           group by b.bucket, el order by b.bucket`,
          [...base(f), f.granularity, top],
        )
      ).rows
    : [];
  const sessions = await c.query(`with s as (${SESSIONS}) select count(*)::int n, count(*) filter (where device = 'desktop')::int desktop from s`, base(f));
  return { elements, series, top, sessions: sessions.rows[0] };
}

/* ------------------------------------------------------------------ heatmaps */
export async function heatmap(c: PoolClient, f: Filters, bucket: string, layout: string) {
  const b = ["desktop", "tablet", "mobile"].includes(bucket) ? bucket : "desktop";
  const args = [...base(f), b, layout];
  const q = (sql: string) =>
    c.query(
      `with s as (${SESSIONS}),
       p as (select p.id, p.session_id, p.max_scroll, p.sections from public.analytics_pageviews p join s on s.id = p.session_id
             where p.bucket = $6 and ($7 = '' or p.layout = $7)),
       e as (select e.* from public.analytics_events e join p on p.id = e.pageview_id)
       ${sql}`,
      args,
    ).then((r) => r.rows);

  const [counts] = await q(`select (select count(*) from p)::int pageviews, (select count(*) from e where type = 'click')::int clicks,
                                   (select count(*) from e where type = 'hover')::int hovers`);
  const elementClicks = await q(`
    select element, round((rx * 40)::numeric) / 40 as rx, round((ry * 40)::numeric) / 40 as ry, count(*)::int n
    from e where type = 'click' and element is not null and not fixed and rx is not null
    group by 1, 2, 3`);
  const freeClicks = await q(`
    select section, round((sx * 100)::numeric) / 100 as sx, round((sy * 200)::numeric) / 200 as sy, count(*)::int n
    from e where type = 'click' and element is null and section is not null and sx is not null and sy is not null
    group by 1, 2, 3`);
  const fixedClicks = await q(`
    select e.element, coalesce(el.label, e.element) label, count(*)::int n
    from e left join public.analytics_elements el on el.id = e.element
    where type = 'click' and fixed group by 1, 2 order by n desc`);
  const hovers = await q(`
    select e.element, coalesce(el.label, e.element) label, count(*)::int n, count(distinct e.session_id)::int sessions,
           avg(value)::float8 avg_ms, sum(value)::float8 total_ms
    from e left join public.analytics_elements el on el.id = e.element
    where type = 'hover' group by 1, 2 order by total_ms desc`);
  const elementTotals = await q(`
    select e.element, coalesce(el.label, e.element) label, count(*)::int n
    from e left join public.analytics_elements el on el.id = e.element
    where type = 'click' and e.element is not null and not fixed group by 1, 2`);
  const scroll = await q(`
    select d as depth, (count(p.id) filter (where p.max_scroll >= d))::int reached
    from generate_series(0, 100, 5) d cross join p group by d order by d`);
  const sections = await q(`
    select k.key section, count(*)::int reached from p cross join lateral jsonb_each_text(p.sections) k
    where k.value::int > 0 group by 1`);
  const layouts = await c.query(
    `with s as (${SESSIONS})
     select p.layout, count(*)::int pageviews, max(p.started_at) last_seen
     from public.analytics_pageviews p join s on s.id = p.session_id
     where p.bucket = $6 group by p.layout order by last_seen desc limit 10`,
    [...base(f), b],
  ).then((r) => r.rows);
  return { bucket: b, counts, elementClicks, freeClicks, fixedClicks, hovers, elementTotals, scroll, sections, layouts };
}

/* ------------------------------------------------------------------ video */
export async function video(c: PoolClient, f: Filters) {
  const videos = await c.query(
    `with s as (${SESSIONS}),
     v as (select v.* from public.analytics_video_views v join s on s.id = v.session_id),
     ve as (select ve.video_id, ve.type from public.analytics_video_events ve join s on s.id = ve.session_id)
     select v.video_id as id,
       count(*) filter (where impression)::int                                    as impressions,
       coalesce(sum(plays), 0)::int                                                as plays,
       count(*) filter (where plays > 0)::int                                      as unique_plays,
       count(distinct visitor_id) filter (where plays > 0)::int                    as unique_viewers,
       count(*) filter (where impression and plays > 0)::int                      as plays_from_impression,
       count(*) filter (where watched_ms >= 3000)::int                             as plays_3s,
       count(*) filter (where watched_ms >= 10000)::int                            as plays_10s,
       count(*) filter (where watched_ms >= 15000 or (completed and duration_ms > 0 and duration_ms < 15000))::int as thruplays,
       count(*) filter (where plays > 0 and duration_ms > 0 and furthest_ms >= duration_ms * 0.25)::int as p25,
       count(*) filter (where plays > 0 and duration_ms > 0 and furthest_ms >= duration_ms * 0.50)::int as p50,
       count(*) filter (where plays > 0 and duration_ms > 0 and furthest_ms >= duration_ms * 0.75)::int as p75,
       count(*) filter (where plays > 0 and duration_ms > 0 and furthest_ms >= duration_ms * 0.95)::int as p95,
       count(*) filter (where completed)::int                                      as completes,
       coalesce(avg(watched_ms) filter (where plays > 0), 0)::float8               as avg_watch_ms,
       coalesce(sum(watched_ms), 0)::float8                                        as total_watch_ms,
       avg(least(furthest_ms::float8 / nullif(duration_ms, 0), 1)) filter (where plays > 0) as avg_pct,
       max(duration_ms)::int                                                       as duration_ms,
       (select count(*) from ve where ve.video_id = v.video_id and ve.type = 'pause')::int  as pauses,
       (select count(*) from ve where ve.video_id = v.video_id and ve.type = 'resume')::int as resumes,
       (select count(*) from ve where ve.video_id = v.video_id and ve.type = 'seek')::int   as seeks,
       (select count(*) from ve where ve.video_id = v.video_id and ve.type = 'exit')::int   as exits
     from v group by v.video_id order by v.video_id`,
    base(f),
  ).then((r) => r.rows);
  return {
    videos: videos.map((v) => {
      const imp = v.impressions, up = v.unique_plays;
      return {
        ...v,
        playRate: imp ? v.plays_from_impression / imp : null,
        rate3s: imp ? v.plays_3s / imp : null,
        thruplayRate: imp ? v.thruplays / imp : null,
        completionRate: up ? v.completes / up : null,
        retention: up
          ? [
              { k: "0%", n: up },
              { k: "3 detik", n: v.plays_3s },
              { k: "25%", n: v.p25 },
              { k: "50%", n: v.p50 },
              { k: "75%", n: v.p75 },
              { k: "95%", n: v.p95 },
              { k: "100%", n: v.completes },
            ].map((x) => ({ ...x, pct: x.n / up }))
          : [],
      };
    }),
  };
}
