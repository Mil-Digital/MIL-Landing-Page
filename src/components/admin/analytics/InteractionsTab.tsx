"use client";
import { BarList, DataTable, fmtDuration, fmtInt, fmtPct, LineChart, SERIES } from "./charts";
import { bucketLabel, EmptyState, ErrorBox, Info, Loading, METRICS, Panel, Stat, useAnalytics, type Query } from "./ui";

export type ElementRow = {
  id: string; label: string; section: string | null; kind: string | null;
  exposures: number; exposed_sessions: number; clicks: number; click_sessions: number;
  hovers: number; hover_sessions: number; avg_hover_ms: number | null; engaged_sessions: number;
  clicks_desktop: number; clicks_mobile: number; clicks_tablet: number; ctr: number | null; engagement: number | null;
};

/** Rates on tiny samples are noise: rank by rate only with ≥ this many exposed sessions. */
const MIN_EXPOSED = 20;

export function InteractionsTab({ q }: { q: Query }) {
  const { data, filters, loading, error, reload } = useAnalytics<{
    elements: ElementRow[]; series: { t: string; element: string; clicks: number }[]; top: string[]; sessions: { n: number; desktop: number };
  }>("interactions", q);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const els = data.elements;
  if (!els.length) {
    return <EmptyState title="Belum ada interaksi tercatat">Klik, hover, dan exposure elemen akan muncul di sini setelah ada pengunjung.</EmptyState>;
  }
  const totalClicks = els.reduce((a, e) => a + e.clicks, 0);
  const totalHovers = els.reduce((a, e) => a + e.hovers, 0);
  const hoverMs = els.reduce((a, e) => a + (e.avg_hover_ms ?? 0) * e.hovers, 0);
  const reliable = els.filter((e) => e.exposed_sessions >= MIN_EXPOSED);
  const label = (id: string) => els.find((e) => e.id === id)?.label ?? id;

  const labels = [...new Set(data.series.map((s) => s.t))];
  const series = data.top.map((id, i) => ({
    key: id, label: label(id), color: SERIES[i],
    values: labels.map((t) => data.series.find((s) => s.t === t && s.element === id)?.clicks ?? 0),
  }));

  const rank = (items: ElementRow[], val: (e: ElementRow) => number, fmt: (e: ElementRow) => string, sub?: (e: ElementRow) => string) =>
    items.slice(0, 5).map((e) => ({ label: e.label, value: val(e), sub: sub?.(e), title: `${e.id}\n${fmt(e)}` }));

  return (
    <div className={loading ? "a-dim" : ""}>
      <div className="kpi-grid">
        <Stat m="Total clicks" value={fmtInt(totalClicks)} sub={<span className="muted">pada {els.filter((e) => e.clicks).length} elemen</span>} />
        <Stat m="ctaClicks" value={fmtInt(els.filter((e) => e.kind === "cta" || e.kind === "whatsapp").reduce((a, e) => a + e.clicks, 0))} sub={<span className="muted">Hero, Closing CTA & WhatsApp</span>} />
        <Stat m="Top element CTR" value={fmtPct(Math.max(0, ...reliable.map((e) => e.ctr ?? 0)))} sub={<span className="muted">{reliable.length ? `min. ${MIN_EXPOSED} sesi exposure` : "sampel belum cukup"}</span>} />
        <Stat m="hover" value={fmtInt(totalHovers)} sub={<span className="muted">rata-rata {fmtDuration(totalHovers ? hoverMs / totalHovers : null)}</span>} />
        <Stat m="Sesi desktop" value={fmtInt(data.sessions.desktop)} sub={<span className="muted">hover hanya diukur di perangkat dengan mouse</span>} />
      </div>
      {totalClicks === 0 && <div className="alert info mt-16">Belum ada klik di periode ini; exposure sudah tercatat.</div>}

      <div className="grid grid-2 mt-16 a-rank">
        <Panel title="Most clicked" info={METRICS.uniqueClicks.def}>
          <BarList items={rank([...els].filter((e) => e.clicks).sort((a, b) => b.clicks - a.clicks), (e) => e.clicks, (e) => `${e.clicks} klik`, (e) => `${fmtInt(e.click_sessions)} sesi unik · CTR ${fmtPct(e.ctr)}`)} empty="Belum ada klik." />
        </Panel>
        <Panel title="Highest click rate" info={`${METRICS.ctr.def} Hanya elemen dengan ≥ ${MIN_EXPOSED} sesi exposure.`}>
          <BarList format={(n) => fmtPct(n)} color={SERIES[2]}
            items={rank([...reliable].sort((a, b) => (b.ctr ?? 0) - (a.ctr ?? 0)), (e) => e.ctr ?? 0, (e) => fmtPct(e.ctr), (e) => `${fmtInt(e.click_sessions)} dari ${fmtInt(e.exposed_sessions)} sesi`)}
            empty={`Belum ada elemen dengan ≥ ${MIN_EXPOSED} sesi exposure.`} />
        </Panel>
        <Panel title="Most hovered" info={METRICS.hover.def}>
          <BarList color={SERIES[1]} items={rank([...els].filter((e) => e.hovers).sort((a, b) => b.hovers - a.hovers), (e) => e.hovers, (e) => `${e.hovers} hover`, (e) => `rata-rata ${fmtDuration(e.avg_hover_ms)} · ${fmtInt(e.hover_sessions)} sesi`)} empty="Belum ada hover (desktop)." />
        </Panel>
        <Panel title="Highest engagement" info={`${METRICS.engagement.def} Hanya elemen dengan ≥ ${MIN_EXPOSED} sesi exposure.`}>
          <BarList format={(n) => fmtPct(n)} color={SERIES[6]}
            items={rank([...reliable].sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0)), (e) => e.engagement ?? 0, (e) => fmtPct(e.engagement))}
            empty={`Belum ada elemen dengan ≥ ${MIN_EXPOSED} sesi exposure.`} />
        </Panel>
      </div>

      {series.length > 0 && (
        <div className="mt-16">
          <Panel title="Clicks over time" sub="5 elemen dengan klik terbanyak">
            <LineChart labels={labels.map((t) => bucketLabel(t, filters?.granularity ?? "day"))} series={series} />
          </Panel>
        </div>
      )}

      <div className="mt-16">
        <Panel title="Semua elemen" sub="Klik header kolom untuk mengurutkan. Elemen dengan CTR rendah tapi exposure tinggi = kurang menarik perhatian."
          info={`${METRICS.exposures.def} ${METRICS.ctr.def}`}>
          <DataTable rows={els} initialSort="clicks" cols={[
            { key: "label", label: "Elemen", sort: (r) => r.label, render: (r) => <span title={r.id}>{r.label}<div className="muted small mono">{r.id}</div></span> },
            { key: "exp", label: <>Exposures<Info text={METRICS.exposures.def} /></>, num: true, sort: (r) => r.exposed_sessions, render: (r) => <span title={`${r.exposures} page view`}>{fmtInt(r.exposed_sessions)}</span>, title: "Sesi yang melihat elemen" },
            { key: "clicks", label: "Clicks", num: true, sort: (r) => r.clicks, render: (r) => fmtInt(r.clicks) },
            { key: "unique", label: "Unique", num: true, sort: (r) => r.click_sessions, render: (r) => fmtInt(r.click_sessions) },
            { key: "ctr", label: "CTR", num: true, sort: (r) => r.ctr ?? -1, render: (r) => <span className={r.exposed_sessions < MIN_EXPOSED ? "muted" : ""} title={r.exposed_sessions < MIN_EXPOSED ? "Sampel kecil" : ""}>{fmtPct(r.ctr)}</span> },
            { key: "dev", label: "Desktop / Mobile / Tablet", num: true, render: (r) => `${fmtInt(r.clicks_desktop)} / ${fmtInt(r.clicks_mobile)} / ${fmtInt(r.clicks_tablet)}` },
            { key: "hovers", label: "Hovers", num: true, sort: (r) => r.hovers, render: (r) => fmtInt(r.hovers) },
            { key: "avgh", label: "Avg. hover", num: true, sort: (r) => r.avg_hover_ms ?? 0, render: (r) => fmtDuration(r.avg_hover_ms) },
            { key: "eng", label: "Engagement", num: true, sort: (r) => r.engagement ?? -1, render: (r) => fmtPct(r.engagement) },
          ]} />
        </Panel>
      </div>
    </div>
  );
}
