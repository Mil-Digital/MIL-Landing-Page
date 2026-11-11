"use client";
import { useState } from "react";
import { Columns, DataTable, fmtDuration, fmtInt, fmtPct, SERIES } from "./charts";
import { EmptyState, ErrorBox, Info, Loading, METRICS, Panel, Stat, useAnalytics, type Query } from "./ui";

type V = {
  id: string; impressions: number; plays: number; unique_plays: number; unique_viewers: number; plays_3s: number; plays_10s: number;
  thruplays: number; p25: number; p50: number; p75: number; p95: number; completes: number; avg_watch_ms: number; total_watch_ms: number;
  avg_pct: number | null; duration_ms: number; pauses: number; resumes: number; seeks: number; exits: number;
  playRate: number | null; rate3s: number | null; thruplayRate: number | null; completionRate: number | null;
  retention: { k: string; n: number; pct: number }[];
};

export function VideoTab({ q }: { q: Query }) {
  const { data, loading, error, reload } = useAnalytics<{ videos: V[]; labels: Record<string, string> }>("video", q);
  const [sel, setSel] = useState<string | null>(null);
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const vids = data.videos;
  const name = (id: string) => data.labels[id] ?? id;
  if (!vids.length) return <EmptyState title="Belum ada data video">Impression dan play video testimoni akan muncul setelah ada pengunjung yang melihat section Testimonials.</EmptyState>;

  const sum = (k: keyof V) => vids.reduce((a, v) => a + (Number(v[k]) || 0), 0);
  const imp = sum("impressions"), up = sum("unique_plays");
  const v = vids.find((x) => x.id === sel) ?? [...vids].sort((a, b) => b.unique_plays - a.unique_plays)[0];

  return (
    <div className={loading ? "a-dim" : ""}>
      <div className="kpi-grid">
        <Stat m="impressions" value={fmtInt(imp)} sub={<span className="muted">{vids.length} video</span>} />
        <Stat m="videoPlays" value={fmtInt(sum("plays"))} sub={<span className="muted">{fmtInt(up)} unique plays</span>} />
        <Stat m="video3s" value={fmtInt(sum("plays_3s"))} sub={<span className="muted">3s view rate {fmtPct(imp ? sum("plays_3s") / imp : null)}</span>} />
        <Stat m="thruplays" value={fmtInt(sum("thruplays"))} sub={<span className="muted">ThruPlay rate {fmtPct(imp ? sum("thruplays") / imp : null)}</span>} />
        <Stat m="avgWatch" value={fmtDuration(up ? sum("total_watch_ms") / up : null)} sub={<span className="muted">completion {fmtPct(up ? sum("completes") / up : null)}</span>} />
      </div>

      <div className="mt-16">
        <Panel title="Perbandingan video" sub="Klik baris untuk melihat detail & retention" info="Rate memakai penyebut berbeda — arahkan kursor ke ikon (i) di header kolom.">
          <DataTable rows={vids} initialSort="up" cols={[
            { key: "name", label: "Video", render: (r) => <button className={`linkish${r.id === v.id ? " on" : ""}`} onClick={() => setSel(r.id)}>{name(r.id)}</button> },
            { key: "imp", label: <>Impr.<Info text={METRICS.impressions.def} /></>, num: true, sort: (r) => r.impressions, render: (r) => fmtInt(r.impressions) },
            { key: "up", label: <>Plays<Info text={`${METRICS.uniquePlays.def} Angka kecil: total plays termasuk replay.`} /></>, num: true, sort: (r) => r.unique_plays, render: (r) => <>{fmtInt(r.unique_plays)}<div className="muted small">{fmtInt(r.plays)} total</div></> },
            { key: "3s", label: "3s plays", num: true, sort: (r) => r.plays_3s, render: (r) => fmtInt(r.plays_3s) },
            { key: "tp", label: "ThruPlays", num: true, sort: (r) => r.thruplays, render: (r) => fmtInt(r.thruplays) },
            { key: "pr", label: <>Play rate<Info text={METRICS.playRate.def} /></>, num: true, sort: (r) => r.playRate ?? -1, render: (r) => fmtPct(r.playRate) },
            { key: "r3", label: <>3s rate<Info text={METRICS.rate3s.def} /></>, num: true, sort: (r) => r.rate3s ?? -1, render: (r) => fmtPct(r.rate3s) },
            { key: "tr", label: <>ThruPlay rate<Info text={METRICS.thruplayRate.def} /></>, num: true, sort: (r) => r.thruplayRate ?? -1, render: (r) => fmtPct(r.thruplayRate) },
            { key: "cr", label: <>Completion<Info text={METRICS.completionRate.def} /></>, num: true, sort: (r) => r.completionRate ?? -1, render: (r) => fmtPct(r.completionRate) },
            { key: "aw", label: "Avg. watch", num: true, sort: (r) => r.avg_watch_ms, render: (r) => fmtDuration(r.avg_watch_ms) },
          ]} />
        </Panel>
      </div>

      <div className="grid a-split mt-16">
        <Panel title={`Retention — ${name(v.id)}`} sub={`Durasi ${fmtDuration(v.duration_ms)} · dari ${fmtInt(v.unique_plays)} unique plays`}
          info={`Persentase unique plays yang masih menonton di tiap titik. ${METRICS.milestone.def}`}>
          {v.unique_plays ? (
            <>
              <Columns color={SERIES[0]} items={v.retention.map((r, i) => ({
                label: r.k, value: r.pct, display: fmtPct(r.pct, 0),
                note: i ? `−${fmtPct(Math.max(0, v.retention[i - 1].pct - r.pct), 0)}` : undefined,
              }))} />
              <p className="muted small">Angka kecil di bawah = drop-off dibanding titik sebelumnya. {dropNote(v)}</p>
            </>
          ) : <EmptyState title="Video ini belum pernah diputar" />}
        </Panel>
        <Panel title="Semua metric" sub={name(v.id)}>
          <dl className="kv two">
            <dt>Total impressions</dt><dd>{fmtInt(v.impressions)}</dd>
            <dt>Total plays</dt><dd>{fmtInt(v.plays)}</dd>
            <dt>Unique plays</dt><dd>{fmtInt(v.unique_plays)}</dd>
            <dt>Unique viewers</dt><dd>{fmtInt(v.unique_viewers)}</dd>
            <dt>3-second plays</dt><dd>{fmtInt(v.plays_3s)}</dd>
            <dt>10-second plays</dt><dd>{fmtInt(v.plays_10s)}</dd>
            <dt>25% / 50% views</dt><dd>{fmtInt(v.p25)} / {fmtInt(v.p50)}</dd>
            <dt>75% / 95% views</dt><dd>{fmtInt(v.p75)} / {fmtInt(v.p95)}</dd>
            <dt>Completed views</dt><dd>{fmtInt(v.completes)}</dd>
            <dt>ThruPlays</dt><dd>{fmtInt(v.thruplays)}</dd>
            <dt>Average watch time <Info text={METRICS.avgWatch.def} /></dt><dd>{fmtDuration(v.avg_watch_ms)}</dd>
            <dt>Avg. % watched <Info text={METRICS.avgPct.def} /></dt><dd>{fmtPct(v.avg_pct)}</dd>
            <dt>Play rate</dt><dd>{fmtPct(v.playRate)}</dd>
            <dt>3-second view rate</dt><dd>{fmtPct(v.rate3s)}</dd>
            <dt>ThruPlay rate</dt><dd>{fmtPct(v.thruplayRate)}</dd>
            <dt>Completion rate</dt><dd>{fmtPct(v.completionRate)}</dd>
            <dt>Pause / resume / seek</dt><dd>{fmtInt(v.pauses)} / {fmtInt(v.resumes)} / {fmtInt(v.seeks)}</dd>
            <dt>Exit sebelum selesai <Info text="Pengunjung meninggalkan halaman saat video sudah diputar tapi belum selesai." /></dt><dd>{fmtInt(v.exits)}</dd>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function dropNote(v: V) {
  if (v.retention.length < 2) return "";
  let worst = 1, drop = 0;
  for (let i = 1; i < v.retention.length; i++) {
    const d = v.retention[i - 1].pct - v.retention[i].pct;
    if (d > drop) { drop = d; worst = i; }
  }
  return drop > 0 ? `Drop-off terbesar: ${v.retention[worst - 1].k} → ${v.retention[worst].k} (−${fmtPct(drop, 0)}).` : "";
}
