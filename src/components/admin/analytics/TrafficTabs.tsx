"use client";
import { useState } from "react";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { BarList, CHANNEL_COLOR, DataTable, DEVICE_COLOR, Donut, fmtDuration, fmtInt, fmtPct, LineChart, SERIES } from "./charts";
import { bucketLabel, EmptyState, ErrorBox, Loading, Panel, Stat, useAnalytics, type Query } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Summary = {
  sessions: number; uniqueVisitors: number; totalVisitors: number; pageviews: number; pagesPerSession: number;
  avgSessionMs: number; bounceRate: number | null; newVisitors: number; returningVisitors: number;
  ctaClicks: number; elementClicks: number; clickRate: number | null; videoPlays: number; video3s: number; thruplays: number;
  lastActivity: string | null;
};
type Series = { t: string; visitors: number; sessions: number; pageviews: number }[];

const SECTION_LABEL: Record<string, string> = {
  hero: "Hero", clients: "Brand Statistics", workflow: "MIL Workflow", services: "Services",
  testimonials: "Testimonials", cta: "Closing CTA", footer: "Footer",
};
const SECTION_ORDER = Object.keys(SECTION_LABEL);
const DEVICE_LABEL: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", tablet: "Tablet" };

function TrafficChart({ series, granularity }: { series: Series; granularity: string }) {
  const [on, setOn] = useState({ visitors: true, sessions: true, pageviews: false });
  const defs = [
    { key: "visitors", label: "Visitors", color: SERIES[0] },
    { key: "sessions", label: "Sessions", color: SERIES[1] },
    { key: "pageviews", label: "Page views", color: SERIES[2] },
  ] as const;
  const shown = defs.filter((d) => on[d.key]);
  return (
    <>
      <div className="chip-row">
        {defs.map((d) => (
          <button key={d.key} className={`chip${on[d.key] ? " on" : ""}`} aria-pressed={on[d.key]}
            onClick={() => setOn((o) => (shown.length === 1 && o[d.key] ? o : { ...o, [d.key]: !o[d.key] }))}>
            <span className="sw" style={{ background: d.color }} /> {d.label}
          </button>
        ))}
      </div>
      <LineChart labels={series.map((s) => bucketLabel(s.t, granularity))}
        series={shown.map((d) => ({ key: d.key, label: d.label, color: d.color, values: series.map((s) => s[d.key]) }))} />
    </>
  );
}

function NoData({ last }: { last?: string | null }) {
  return (
    <EmptyState title="Belum ada data untuk filter ini">
      Data muncul setelah pengunjung membuka website dan (pada mode opt-in) menyetujui analytics.
      {last === null ? " Coba perbesar rentang tanggal atau hapus filter device/sumber." : ""}
    </EmptyState>
  );
}

/* ================================================================== OVERVIEW */
export function OverviewTab({ q }: { q: Query }) {
  const { data, filters, meta, loading, error, reload } = useAnalytics<{ current: Summary; previous: Summary; series: Series; topElements: any[] }>("overview", q);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const c = data.current, p = data.previous;
  return (
    <div className={loading ? "a-dim" : ""}>
      <div className="kpi-grid">
        <Stat m="totalVisitors" value={fmtInt(c.totalVisitors)} cur={c.totalVisitors} prev={p.totalVisitors} />
        <Stat m="sessions" value={fmtInt(c.sessions)} cur={c.sessions} prev={p.sessions} />
        <Stat m="pageviews" value={fmtInt(c.pageviews)} cur={c.pageviews} prev={p.pageviews} />
        <Stat m="avgSession" value={fmtDuration(c.avgSessionMs)} cur={c.avgSessionMs} prev={p.avgSessionMs} />
        <Stat m="bounceRate" value={fmtPct(c.bounceRate)} cur={c.bounceRate} prev={p.bounceRate} />
      </div>
      <div className="kpi-grid mt-16">
        <Stat m="ctaClicks" value={fmtInt(c.ctaClicks)} cur={c.ctaClicks} prev={p.ctaClicks} />
        <Stat m="clickRate" value={fmtPct(c.clickRate)} cur={c.clickRate} prev={p.clickRate} />
        <Stat m="videoPlays" value={fmtInt(c.videoPlays)} cur={c.videoPlays} prev={p.videoPlays} />
        <Stat m="video3s" value={fmtInt(c.video3s)} cur={c.video3s} prev={p.video3s} />
        <Stat m="thruplays" value={fmtInt(c.thruplays)} cur={c.thruplays} prev={p.thruplays} />
      </div>
      <div className="grid a-split mt-16">
        <Panel title="Traffic" sub={filters ? `${filters.from} – ${filters.to}` : ""}>
          {c.sessions ? <TrafficChart series={data.series} granularity={filters?.granularity ?? "day"} /> : <NoData last={c.lastActivity} />}
        </Panel>
        <Panel title="Interaksi teratas" sub="Klik pada elemen yang dilacak" info="CTR = sesi yang mengklik ÷ sesi yang melihat elemen.">
          <BarList
            empty="Belum ada klik."
            items={data.topElements.filter((e) => e.clicks > 0).map((e) => ({ label: e.label, value: e.clicks, sub: <>CTR {fmtPct(e.ctr)} · {fmtInt(e.click_sessions)} sesi</> }))}
          />
        </Panel>
      </div>
      {c.lastActivity && <p className="muted mt-8 small">Aktivitas terakhir: {new Date(c.lastActivity).toLocaleString("id-ID", { timeZone: meta?.timezone })} ({meta?.timezone})</p>}
    </div>
  );
}

/* ================================================================== TRAFFIC */
export function TrafficTab({ q }: { q: Query }) {
  const ov = useAnalytics<{ current: Summary; previous: Summary; series: Series }>("overview", q);
  const tr = useAnalytics<any>("traffic", q);
  if (ov.error || tr.error) return <ErrorBox error={(ov.error || tr.error)!} onRetry={() => { ov.reload(); tr.reload(); }} />;
  if (!ov.data || !tr.data) return <Loading />;
  const c = ov.data.current, p = ov.data.previous, t = tr.data;
  const totalSessions = c.sessions;
  const share = (n: number) => (totalSessions ? n / totalSessions : 0);

  return (
    <div className={ov.loading || tr.loading ? "a-dim" : ""}>
      <div className="kpi-grid">
        <Stat m="totalVisitors" value={fmtInt(c.totalVisitors)} cur={c.totalVisitors} prev={p.totalVisitors} />
        <Stat m="uniqueVisitors" value={fmtInt(c.uniqueVisitors)} cur={c.uniqueVisitors} prev={p.uniqueVisitors} />
        <Stat m="sessions" value={fmtInt(c.sessions)} cur={c.sessions} prev={p.sessions} />
        <Stat m="pageviews" value={fmtInt(c.pageviews)} cur={c.pageviews} prev={p.pageviews} />
        <Stat m="pagesPerSession" value={c.pagesPerSession.toLocaleString("id-ID", { maximumFractionDigits: 2 })} cur={c.pagesPerSession} prev={p.pagesPerSession} />
        <Stat m="avgSession" value={fmtDuration(c.avgSessionMs)} cur={c.avgSessionMs} prev={p.avgSessionMs} />
        <Stat m="bounceRate" value={fmtPct(c.bounceRate)} cur={c.bounceRate} prev={p.bounceRate} />
        <Stat m="newVisitors" value={fmtInt(c.newVisitors)} cur={c.newVisitors} prev={p.newVisitors} />
        <Stat m="returningVisitors" value={fmtInt(c.returningVisitors)} cur={c.returningVisitors} prev={p.returningVisitors} />
      </div>

      <div className="mt-16">
        <Panel title="Traffic over time" sub="Visitors = pengunjung unik per titik waktu">
          {c.sessions ? <TrafficChart series={ov.data.series} granularity={tr.filters?.granularity ?? "day"} /> : <NoData last={c.lastActivity} />}
        </Panel>
      </div>

      <div className="grid a-split mt-16">
        <Panel title="Traffic sources" sub="Channel ditentukan di awal sesi (UTM → referrer → direct)"
          info="Direct = tanpa referrer & tanpa UTM. Organic = mesin pencari. Social = media sosial. Referral = website lain. Paid Ads = utm_medium cpc/paid/ads atau gclid. Email = utm_medium email. Other = UTM lain.">
          {t.channels.length ? (
            <Donut center={<><b>{fmtInt(totalSessions)}</b><span>sesi</span></>}
              items={t.channels.map((x: any) => ({ key: x.channel, label: (CHANNEL_LABELS as any)[x.channel] ?? x.channel, value: x.sessions, color: CHANNEL_COLOR[x.channel] ?? SERIES[7] }))} />
          ) : <NoData />}
        </Panel>
        <Panel title="Detail channel">
          <DataTable rows={t.channels} initialSort="sessions" cols={[
            { key: "channel", label: "Channel", render: (r: any) => <span className="row" style={{ gap: 6 }}><span className="sw" style={{ background: CHANNEL_COLOR[r.channel] }} />{(CHANNEL_LABELS as any)[r.channel]}</span> },
            { key: "sessions", label: "Sesi", num: true, sort: (r: any) => r.sessions, render: (r: any) => fmtInt(r.sessions) },
            { key: "share", label: "%", num: true, render: (r: any) => fmtPct(share(r.sessions)) },
            { key: "visitors", label: "Visitors", num: true, sort: (r: any) => r.visitors, render: (r: any) => fmtInt(r.visitors) },
            { key: "bounce", label: "Bounce", num: true, sort: (r: any) => r.bounce_rate, render: (r: any) => fmtPct(r.bounce_rate) },
            { key: "dur", label: "Durasi", num: true, sort: (r: any) => r.avg_ms, render: (r: any) => fmtDuration(r.avg_ms) },
          ]} />
        </Panel>
      </div>

      <div className="grid a-split mt-16">
        <Panel title="Kampanye (UTM)" sub="UTM dari URL pertama sesi; tetap melekat saat pengunjung berpindah halaman">
          <DataTable rows={t.campaigns} initialSort="sessions" limit={8} empty="Belum ada kunjungan dengan parameter UTM." cols={[
            { key: "src", label: "Source / Medium", render: (r: any) => <><b>{r.utm_source ?? "—"}</b> / {r.utm_medium ?? "—"}</> },
            { key: "camp", label: "Campaign", render: (r: any) => <>{r.utm_campaign ?? "—"}{(r.utm_content || r.utm_term) && <div className="muted small">{[r.utm_content && `content: ${r.utm_content}`, r.utm_term && `term: ${r.utm_term}`].filter(Boolean).join(" · ")}</div>}</> },
            { key: "sessions", label: "Sesi", num: true, sort: (r: any) => r.sessions, render: (r: any) => fmtInt(r.sessions) },
            { key: "bounce", label: "Bounce", num: true, sort: (r: any) => r.bounce_rate, render: (r: any) => fmtPct(r.bounce_rate) },
          ]} />
        </Panel>
        <Panel title="Referring domains">
          <DataTable rows={t.referrers} initialSort="sessions" limit={8} empty="Belum ada referrer (semua kunjungan direct / UTM)." cols={[
            { key: "domain", label: "Domain", render: (r: any) => <span title={r.example}>{r.domain}<div className="muted small">{(CHANNEL_LABELS as any)[r.channel]}</div></span> },
            { key: "sessions", label: "Sesi", num: true, sort: (r: any) => r.sessions, render: (r: any) => fmtInt(r.sessions) },
            { key: "visitors", label: "Visitors", num: true, sort: (r: any) => r.visitors, render: (r: any) => fmtInt(r.visitors) },
          ]} />
        </Panel>
      </div>

      <h3 className="a-h3">Visitor insights</h3>
      <div className="grid grid-3">
        <Panel title="Device">
          <Donut size={140} items={t.devices.map((d: any) => ({ key: d.name, label: DEVICE_LABEL[d.name] ?? d.name, value: d.sessions, color: DEVICE_COLOR[d.name] ?? SERIES[3] }))} />
        </Panel>
        <Panel title="New vs returning" info="Per sesi: sesi pertama seorang pengunjung = new; sesi berikutnya = returning.">
          <Donut size={140} items={["new", "returning"].map((k, i) => ({ key: k, label: k === "new" ? "New" : "Returning", value: t.visitorTypes.find((v: any) => v.name === k)?.sessions ?? 0, color: SERIES[i] }))} />
        </Panel>
        <Panel title="Negara" info="Perkiraan dari lokasi jaringan (edge Vercel), bukan GPS. Alamat IP tidak disimpan.">
          <BarList items={t.countries.slice(0, 6).map((x: any) => ({ label: countryName(x.name), value: x.sessions }))} />
        </Panel>
        <Panel title="Kota">
          <BarList items={t.cities.slice(0, 6).map((x: any) => ({ label: `${x.name}${x.country ? `, ${x.country}` : ""}`, value: x.sessions }))} />
        </Panel>
        <Panel title="Browser">
          <BarList items={t.browsers.slice(0, 6).map((x: any) => ({ label: x.name, value: x.sessions }))} />
        </Panel>
        <Panel title="Sistem operasi">
          <BarList items={t.os.slice(0, 6).map((x: any) => ({ label: x.name, value: x.sessions }))} />
        </Panel>
      </div>

      <h3 className="a-h3">Top pages & sections</h3>
      <div className="grid a-split">
        <Panel title="Halaman" info="Bounce rate = sesi yang masuk di halaman ini & tidak engaged ÷ sesi yang masuk di halaman ini. Exit rate = page view yang menjadi halaman terakhir sesi ÷ page view halaman ini.">
          <DataTable rows={t.pages} initialSort="pageviews" cols={[
            { key: "path", label: "URL", render: (r: any) => <span className="mono">{r.path}</span> },
            { key: "pageviews", label: "Views", num: true, sort: (r: any) => r.pageviews, render: (r: any) => fmtInt(r.pageviews) },
            { key: "visitors", label: "Unique", num: true, sort: (r: any) => r.visitors, render: (r: any) => fmtInt(r.visitors) },
            { key: "avg", label: "Avg. time", num: true, sort: (r: any) => r.avg_ms, render: (r: any) => fmtDuration(r.avg_ms) },
            { key: "bounce", label: "Bounce", num: true, sort: (r: any) => r.bounce_rate ?? 0, render: (r: any) => fmtPct(r.bounce_rate) },
            { key: "exit", label: "Exit", num: true, sort: (r: any) => r.exit_rate ?? 0, render: (r: any) => fmtPct(r.exit_rate) },
          ]} />
        </Panel>
        <Panel title="Performa section (landing page)" info="Reach = page view di mana section terlihat (≥ 30% section, atau mengisi ≥ 50% layar). Waktu = rata-rata waktu section terlihat, untuk page view yang menjangkaunya.">
          {t.sections.length ? (
            <BarList format={(n) => fmtPct(n, 0)}
              items={[...t.sections].sort((a: any, b: any) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section))
                .map((s: any) => ({ label: SECTION_LABEL[s.section] ?? s.section, value: s.reached / Math.max(1, s.pageviews), sub: <>{fmtInt(s.reached)} page view · rata-rata {fmtDuration(s.avg_ms)} terlihat</> }))} />
          ) : <NoData />}
        </Panel>
      </div>
    </div>
  );
}

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["id"], { type: "region" }) : null;
function countryName(code: string) {
  if (!code || code === "Unknown") return "Tidak diketahui";
  try { return regionNames?.of(code) ?? code; } catch { return code; }
}
