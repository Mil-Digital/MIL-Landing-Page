-- =====================================================================
--  MIL Digital — Website Analytics, interaction tracking & heatmaps
--  LANGKAH 4 — jalankan di Neon SQL Editor (sebagai neondb_owner) setelah
--  001_schema.sql. Aman dijalankan ulang (idempotent).
--
--  Security model (same as the CMS)
--  - Visitors never touch tables. The public endpoint /api/collect validates the
--    payload on the server and calls analytics_ingest() (security definer).
--    cms_app has NO insert/update/delete privilege on analytics tables.
--  - Dashboard reads: SELECT for cms_app, restricted by RLS to is_admin().
--  - Deleting data: analytics_purge() — retention (cron) or owner-only manual delete.
--
--  Privacy
--  - Pseudonymous random IDs only (generated in the browser, no fingerprinting).
--  - No IP address, no form input, no page text, no raw mouse movement is stored.
--  - Geo = country/region/city from Vercel's edge headers (approximate, not GPS).
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cms_app') then
    raise exception 'Role cms_app belum ada. Jalankan db/00_create_app_role.sql terlebih dahulu.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table if not exists public.analytics_visitors (
  id          uuid primary key,
  first_seen  timestamptz not null,
  last_seen   timestamptz not null,
  sessions    int not null default 0
);
create index if not exists analytics_visitors_first_seen_idx on public.analytics_visitors (first_seen);

create table if not exists public.analytics_sessions (
  id               uuid primary key,
  visitor_id       uuid not null references public.analytics_visitors (id) on delete cascade,
  started_at       timestamptz not null,
  last_seen_at     timestamptz not null,
  is_returning     boolean not null default false,
  landing_path     text,
  exit_path        text,
  referrer         text,
  referrer_domain  text,
  channel          text not null default 'direct'
                   check (channel in ('direct','organic','social','referral','paid','email','other')),
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  device           text not null default 'desktop' check (device in ('desktop','mobile','tablet')),
  browser          text,
  os               text,
  country          text,
  region           text,
  city             text,
  pageviews        int not null default 0,
  duration_ms      int not null default 0,
  clicks           int not null default 0,
  engaged          boolean not null default false
);
create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_sessions (visitor_id, started_at);
create index if not exists analytics_sessions_channel_idx on public.analytics_sessions (channel, started_at);
create index if not exists analytics_sessions_device_idx  on public.analytics_sessions (device, started_at);

create table if not exists public.analytics_pageviews (
  id           uuid primary key,
  session_id   uuid not null references public.analytics_sessions (id) on delete cascade,
  visitor_id   uuid not null,
  path         text not null,
  started_at   timestamptz not null,
  last_seen_at timestamptz not null,
  layout       text,                 -- layout version (template + published content hash)
  bucket       text not null check (bucket in ('desktop','tablet','mobile')), -- layout bucket by viewport width
  vw           int,
  vh           int,
  doc_h        int,
  active_ms    int not null default 0,
  max_scroll   smallint not null default 0 check (max_scroll between 0 and 100),
  sections     jsonb not null default '{}'::jsonb   -- {section_id: visible_ms}
);
create index if not exists analytics_pageviews_session_idx on public.analytics_pageviews (session_id, started_at);
create index if not exists analytics_pageviews_started_idx on public.analytics_pageviews (started_at);

-- Readable names of tracked elements (the stable id is data-analytics-id on the page).
create table if not exists public.analytics_elements (
  id        text primary key,
  label     text not null,
  section   text,
  kind      text,
  last_seen timestamptz not null default now()
);

-- Interaction events: click | hover | exposure | scroll (milestone)
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  pageview_id uuid not null references public.analytics_pageviews (id) on delete cascade,
  session_id  uuid not null,
  seq         int  not null,           -- client sequence inside the page view (dedup key)
  ts          timestamptz not null,
  type        text not null check (type in ('click','hover','exposure','scroll')),
  element     text,                    -- data-analytics-id (null = click outside a tracked element)
  section     text,                    -- data-analytics-section
  rx real, ry real,                    -- position inside the element (0..1)
  sx real, sy real,                    -- x: fraction of viewport width, y: fraction of section height
  fixed       boolean not null default false,  -- element is position:fixed (e.g. floating WhatsApp)
  value       int,                     -- hover duration ms | scroll depth %
  unique (pageview_id, seq)
);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id, type);
create index if not exists analytics_events_element_idx on public.analytics_events (element, type);
create index if not exists analytics_events_ts_idx      on public.analytics_events (ts);

-- One row per (page view, video): playback summary measured from actual playback time.
create table if not exists public.analytics_video_views (
  pageview_id  uuid not null references public.analytics_pageviews (id) on delete cascade,
  video_id     text not null,
  session_id   uuid not null,
  visitor_id   uuid not null,
  first_ts     timestamptz not null,
  impression   boolean not null default false,
  plays        int not null default 0,
  watched_ms   int not null default 0,   -- real playback time (paused / seeking excluded)
  furthest_ms  int not null default 0,   -- furthest point reached by playing (not by seeking)
  duration_ms  int not null default 0,
  completed    boolean not null default false,
  primary key (pageview_id, video_id)
);
create index if not exists analytics_video_views_session_idx on public.analytics_video_views (session_id);
create index if not exists analytics_video_views_video_idx   on public.analytics_video_views (video_id, first_ts);

-- Video event log: play | pause | resume | seek | complete | exit | m3s | m10s | thruplay | p25 | p50 | p75 | p95
create table if not exists public.analytics_video_events (
  id          bigint generated always as identity primary key,
  pageview_id uuid not null references public.analytics_pageviews (id) on delete cascade,
  session_id  uuid not null,
  seq         int  not null,
  ts          timestamptz not null,
  video_id    text not null,
  type        text not null check (type in
                ('play','pause','resume','seek','complete','exit','m3s','m10s','thruplay','p25','p50','p75','p95')),
  position_ms int,
  unique (pageview_id, seq)
);
create index if not exists analytics_video_events_session_idx on public.analytics_video_events (session_id, video_id, type);

-- ---------------------------------------------------------------------
-- 2. Privileges + RLS (read-only for admins; writes only via functions)
-- ---------------------------------------------------------------------
revoke all on public.analytics_visitors, public.analytics_sessions, public.analytics_pageviews,
              public.analytics_elements, public.analytics_events, public.analytics_video_views,
              public.analytics_video_events from public, cms_app;

grant select on public.analytics_visitors, public.analytics_sessions, public.analytics_pageviews,
                public.analytics_elements, public.analytics_events, public.analytics_video_views,
                public.analytics_video_events to cms_app;

do $$
declare t text;
begin
  foreach t in array array['analytics_visitors','analytics_sessions','analytics_pageviews','analytics_elements',
                           'analytics_events','analytics_video_views','analytics_video_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    -- (select is_admin()) is evaluated once per query (initplan), not once per row.
    execute format('create policy %I on public.%I for select to cms_app using ((select public.is_admin()))', t || '_select', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Ingest (called by /api/collect after server-side validation)
-- ---------------------------------------------------------------------
-- Merge two {key: number} objects keeping the max per key.
create or replace function public.analytics_jsonb_max(a jsonb, b jsonb)
returns jsonb language sql immutable
as $$
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from (
    select k, max(v::numeric)::int as v
    from (select key k, value v from jsonb_each_text(coalesce(a, '{}'::jsonb))
          union all
          select key, value from jsonb_each_text(coalesce(b, '{}'::jsonb))) x
    where v ~ '^[0-9]+(\.[0-9]+)?$'
    group by k
  ) y
$$;

create or replace function public.analytics_ingest(p jsonb)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  s   jsonb := p -> 'session';
  pv  jsonb := p -> 'pageview';
  v_sid uuid := (s ->> 'id')::uuid;
  v_vid uuid := (s ->> 'visitor_id')::uuid;
  v_pid uuid := (pv ->> 'id')::uuid;
  v_now timestamptz := now();
  v_owner uuid;
  v_pv_count int;
  v_ev_count int;
  v_inserted boolean;
begin
  if v_sid is null or v_vid is null or v_pid is null then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  -- Visitor
  insert into analytics_visitors (id, first_seen, last_seen)
  values (v_vid, least((s ->> 'started_at')::timestamptz, v_now), v_now)
  on conflict (id) do update set last_seen = greatest(analytics_visitors.last_seen, excluded.last_seen);

  -- Session (attribution & device are fixed at session start: first touch wins)
  insert into analytics_sessions (id, visitor_id, started_at, last_seen_at, is_returning, landing_path, exit_path,
                                  referrer, referrer_domain, channel, utm_source, utm_medium, utm_campaign, utm_content,
                                  utm_term, device, browser, os, country, region, city)
  values (v_sid, v_vid, (s ->> 'started_at')::timestamptz, v_now,
          coalesce((s ->> 'returning')::boolean, false)
            or exists (select 1 from analytics_sessions o where o.visitor_id = v_vid and o.started_at < (s ->> 'started_at')::timestamptz),
          pv ->> 'path', pv ->> 'path',
          s ->> 'referrer', s ->> 'referrer_domain', coalesce(s ->> 'channel', 'direct'),
          s ->> 'utm_source', s ->> 'utm_medium', s ->> 'utm_campaign', s ->> 'utm_content', s ->> 'utm_term',
          coalesce(s ->> 'device', 'desktop'), s ->> 'browser', s ->> 'os', s ->> 'country', s ->> 'region', s ->> 'city')
  on conflict (id) do nothing
  returning true into v_inserted;

  if v_inserted then
    update analytics_visitors set sessions = sessions + 1 where id = v_vid;
  end if;

  -- A session id can only be used by the visitor that created it.
  select visitor_id into v_owner from analytics_sessions where id = v_sid;
  if v_owner is distinct from v_vid then
    return;
  end if;

  -- Abuse guard: a real session never has this many page views / events.
  select pageviews into v_pv_count from analytics_sessions where id = v_sid;
  if v_pv_count >= 300 then return; end if;

  -- Page view (cumulative values: keep the max, so retries / out-of-order batches are safe)
  insert into analytics_pageviews (id, session_id, visitor_id, path, started_at, last_seen_at, layout, bucket,
                                   vw, vh, doc_h, active_ms, max_scroll, sections)
  values (v_pid, v_sid, v_vid, pv ->> 'path', (pv ->> 'started_at')::timestamptz, v_now, pv ->> 'layout',
          pv ->> 'bucket', (pv ->> 'vw')::int, (pv ->> 'vh')::int, (pv ->> 'doc_h')::int,
          coalesce((pv ->> 'active_ms')::int, 0), coalesce((pv ->> 'max_scroll')::int, 0),
          coalesce(pv -> 'sections', '{}'::jsonb))
  on conflict (id) do update set
    last_seen_at = v_now,
    doc_h        = coalesce(excluded.doc_h, analytics_pageviews.doc_h),
    active_ms    = greatest(analytics_pageviews.active_ms, excluded.active_ms),
    max_scroll   = greatest(analytics_pageviews.max_scroll, excluded.max_scroll),
    sections     = analytics_jsonb_max(analytics_pageviews.sections, excluded.sections)
  where analytics_pageviews.session_id = v_sid;

  if not exists (select 1 from analytics_pageviews where id = v_pid and session_id = v_sid) then
    return; -- page view id belongs to another session
  end if;

  select count(*) into v_ev_count from analytics_events where session_id = v_sid;
  if v_ev_count < 5000 then
    -- Element names
    insert into analytics_elements (id, label, section, kind, last_seen)
    select distinct on (e ->> 'id') e ->> 'id', e ->> 'label', e ->> 'section', e ->> 'kind', v_now
    from jsonb_array_elements(coalesce(p -> 'elements', '[]'::jsonb)) e
    on conflict (id) do update set label = excluded.label, section = excluded.section, kind = excluded.kind, last_seen = v_now;

    insert into analytics_events (pageview_id, session_id, seq, ts, type, element, section, rx, ry, sx, sy, fixed, value)
    select v_pid, v_sid, (e ->> 'seq')::int, (e ->> 'ts')::timestamptz, e ->> 'type', e ->> 'element', e ->> 'section',
           (e ->> 'rx')::real, (e ->> 'ry')::real, (e ->> 'sx')::real, (e ->> 'sy')::real,
           coalesce((e ->> 'fixed')::boolean, false), (e ->> 'value')::int
    from jsonb_array_elements(coalesce(p -> 'events', '[]'::jsonb)) e
    on conflict (pageview_id, seq) do nothing;

    insert into analytics_video_events (pageview_id, session_id, seq, ts, video_id, type, position_ms)
    select v_pid, v_sid, (e ->> 'seq')::int, (e ->> 'ts')::timestamptz, e ->> 'video', e ->> 'type', (e ->> 'position_ms')::int
    from jsonb_array_elements(coalesce(p -> 'video_events', '[]'::jsonb)) e
    on conflict (pageview_id, seq) do nothing;
  end if;

  -- Video summaries (cumulative → max)
  insert into analytics_video_views (pageview_id, video_id, session_id, visitor_id, first_ts, impression, plays,
                                     watched_ms, furthest_ms, duration_ms, completed)
  select v_pid, x ->> 'video', v_sid, v_vid, coalesce((x ->> 'first_ts')::timestamptz, v_now),
         coalesce((x ->> 'impression')::boolean, false), coalesce((x ->> 'plays')::int, 0),
         coalesce((x ->> 'watched_ms')::int, 0), coalesce((x ->> 'furthest_ms')::int, 0),
         coalesce((x ->> 'duration_ms')::int, 0), coalesce((x ->> 'completed')::boolean, false)
  from jsonb_array_elements(coalesce(p -> 'videos', '[]'::jsonb)) x
  on conflict (pageview_id, video_id) do update set
    impression  = analytics_video_views.impression or excluded.impression,
    plays       = greatest(analytics_video_views.plays, excluded.plays),
    watched_ms  = greatest(analytics_video_views.watched_ms, excluded.watched_ms),
    furthest_ms = greatest(analytics_video_views.furthest_ms, excluded.furthest_ms),
    duration_ms = greatest(analytics_video_views.duration_ms, excluded.duration_ms),
    completed   = analytics_video_views.completed or excluded.completed;

  -- Session roll-up (small: one session's rows)
  update analytics_sessions ss set
    last_seen_at = v_now,
    exit_path    = (select path from analytics_pageviews where session_id = v_sid order by started_at desc limit 1),
    pageviews    = x.n,
    duration_ms  = x.ms,
    clicks       = c.n,
    engaged      = x.ms >= 10000 or x.n >= 2 or c.n > 0
  from (select count(*)::int n, coalesce(sum(active_ms), 0)::int ms from analytics_pageviews where session_id = v_sid) x,
       (select count(*)::int n from analytics_events where session_id = v_sid and type = 'click') c
  where ss.id = v_sid;
end $$;

-- ---------------------------------------------------------------------
-- 4. Retention & deletion
-- ---------------------------------------------------------------------
-- Retention (called by the daily cron as cms_app): deletes sessions older than p_days (min. 30).
-- mode 'older_than' | 'all' (owner only) | 'visitor' (admin: data-subject request).
create or replace function public.analytics_purge(p_mode text, p_days int default null, p_visitor uuid default null)
returns int
language plpgsql security definer
set search_path = public
as $$
declare v_count int := 0;
begin
  if p_mode = 'older_than' then
    if p_days is null or p_days < 30 then
      raise exception 'Retention must be at least 30 days' using errcode = '22023';
    end if;
    delete from analytics_sessions where started_at < now() - make_interval(days => p_days);
    get diagnostics v_count = row_count;
    delete from analytics_visitors v where last_seen < now() - make_interval(days => p_days)
      and not exists (select 1 from analytics_sessions s where s.visitor_id = v.id);
  elsif p_mode = 'visitor' then
    if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
    delete from analytics_visitors where id = p_visitor;  -- cascades to sessions/page views/events
    get diagnostics v_count = row_count;
  elsif p_mode = 'all' then
    if not exists (select 1 from admin_users where user_id = public.current_app_user() and role = 'owner') then
      raise exception 'Only an owner can delete all analytics data' using errcode = '42501';
    end if;
    select count(*) into v_count from analytics_sessions;
    truncate analytics_video_events, analytics_video_views, analytics_events, analytics_pageviews,
             analytics_sessions, analytics_visitors, analytics_elements;
  else
    raise exception 'Unknown mode %', p_mode using errcode = '22023';
  end if;
  return v_count;
end $$;

revoke execute on function public.analytics_ingest(jsonb)          from public;
revoke execute on function public.analytics_purge(text, int, uuid) from public;
revoke execute on function public.analytics_jsonb_max(jsonb, jsonb) from public;
grant execute on function public.analytics_ingest(jsonb)          to cms_app;
grant execute on function public.analytics_purge(text, int, uuid) to cms_app;
grant execute on function public.analytics_jsonb_max(jsonb, jsonb) to cms_app;
