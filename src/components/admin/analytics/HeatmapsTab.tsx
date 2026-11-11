"use client";
import { useCallback, useState } from "react";
import { Icon } from "@/components/admin/Icon";
import { fmtDuration, fmtInt, fmtPct } from "./charts";
import { DEVICE_FRAME, HeatmapViewer, type HeatData, type HeatMode } from "./HeatmapViewer";
import { EmptyState, ErrorBox, Info, Loading, METRICS, useAnalytics, type Query } from "./ui";

const MODES: { k: HeatMode; label: string; help: string }[] = [
  { k: "click", label: "Click heatmap", help: "Warna makin pekat = makin banyak klik di area itu." },
  { k: "attention", label: "Attention (hover)", help: "Area yang paling lama/lebih sering dilewati kursor mouse (desktop)." },
  { k: "scroll", label: "Scroll map", help: "Area makin gelap = makin sedikit pengunjung yang scroll sampai sana." },
];

export function HeatmapsTab({ q }: { q: Query }) {
  const [bucket, setBucket] = useState<HeatData["bucket"]>("desktop");
  const [mode, setMode] = useState<HeatMode>("click");
  const [layout, setLayout] = useState("current");
  const [showCounts, setShowCounts] = useState(true);
  const [force, setForce] = useState(false);
  const [stats, setStats] = useState<{ mapped: number; unmapped: number; missing: string[] } | null>(null);
  // the heatmap uses the layout bucket (viewport width) instead of the UA device filter
  const { data, meta, loading, error, reload } = useAnalytics<HeatData & { layouts: { layout: string; pageviews: number; last_seen: string }[] }>(
    "heatmap", { ...q, device: "" }, { bucket, layout },
  );
  const onStats = useCallback((s: typeof stats) => setStats(s), []);

  const sample = !data ? 0 : mode === "click" ? data.counts.clicks : mode === "attention" ? data.counts.hovers : data.counts.pageviews;
  const min = meta?.heatmapMinSample ?? 30;
  const enough = sample >= min;
  const current = MODES.find((m) => m.k === mode)!;

  return (
    <div>
      <div className="heat-bar">
        <div className="seg" role="group" aria-label="Device">
          {(Object.keys(DEVICE_FRAME) as HeatData["bucket"][]).map((k) => (
            <button key={k} className={bucket === k ? "on" : ""} onClick={() => { setBucket(k); setForce(false); }}>
              <span className="row" style={{ gap: 6 }}><Icon name={k === "desktop" ? "monitor" : k === "tablet" ? "tablet" : "phone"} size={14} />{DEVICE_FRAME[k].label}</span>
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Jenis heatmap">
          {MODES.map((m) => <button key={m.k} className={mode === m.k ? "on" : ""} onClick={() => { setMode(m.k); setForce(false); }}>{m.label}</button>)}
        </div>
        <select className="select sm-select" value={layout} onChange={(e) => setLayout(e.target.value)} aria-label="Versi layout">
          <option value="current">Layout saat ini</option>
          <option value="all">Semua versi layout</option>
          {data?.layouts.filter((l) => l.layout && l.layout !== meta?.currentLayout).map((l) => (
            <option key={l.layout} value={l.layout}>Versi {l.layout.slice(-6)} · {fmtInt(l.pageviews)} pv · s/d {new Date(l.last_seen).toLocaleDateString("id-ID")}</option>
          ))}
        </select>
        {mode !== "scroll" && (
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={showCounts} onChange={(e) => setShowCounts(e.target.checked)} /> Tampilkan angka
          </label>
        )}
        <button className="btn sm" onClick={reload}><Icon name="refresh" /> Muat ulang</button>
      </div>

      <p className="muted small" style={{ margin: "0 0 12px" }}>
        {current.help} Preview: website live di lebar {DEVICE_FRAME[bucket].w}px; data dari pengunjung dengan layar{" "}
        {bucket === "desktop" ? "> 1100px" : bucket === "tablet" ? "701–1100px" : "≤ 700px"}.
        {mode === "attention" && <> <b>Catatan:</b> hover adalah indikator gerakan mouse, bukan bukti pengunjung benar-benar melihat area itu dengan mata.</>}
      </p>

      {error && <ErrorBox error={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="heat-layout">
          <div className={loading ? "a-dim" : ""}>
            {sample === 0 ? (
              <div className="card"><EmptyState title={`Belum ada data ${current.label.toLowerCase()} untuk ${DEVICE_FRAME[bucket].label}`}>
                {layout === "current" ? "Heatmap dibatasi ke layout saat ini — data dari versi konten sebelumnya bisa dilihat dengan memilih “Semua versi layout”." : "Coba perbesar rentang tanggal."}
              </EmptyState></div>
            ) : !enough && !force ? (
              <div className="card"><EmptyState title="Data belum representatif">
                Baru {fmtInt(sample)} {mode === "click" ? "klik" : mode === "attention" ? "hover" : "page view"} (minimal {min}). Pola dari data sesedikit ini bisa menyesatkan.
                <br /><button className="btn sm mt-8" onClick={() => setForce(true)}>Tetap tampilkan</button>
              </EmptyState></div>
            ) : (
              <>
                {!enough && <div className="alert warn" style={{ marginBottom: 10 }}>Sampel kecil ({fmtInt(sample)} &lt; {min}) — jangan diambil kesimpulan dulu.</div>}
                <HeatmapViewer data={data} mode={mode} showCounts={showCounts} onStats={onStats} />
              </>
            )}
          </div>

          <aside className="heat-side">
            <div className="card card-pad">
              <div className="k muted small">Sampel ({DEVICE_FRAME[bucket].label})</div>
              <dl className="kv">
                <dt>Page views</dt><dd>{fmtInt(data.counts.pageviews)}</dd>
                <dt>Klik</dt><dd>{fmtInt(data.counts.clicks)}</dd>
                <dt>Hover <Info text={METRICS.hover.def} /></dt><dd>{fmtInt(data.counts.hovers)}</dd>
              </dl>
              {stats && stats.unmapped > 0 && (
                <p className="muted small mt-8">{fmtInt(stats.unmapped)} interaksi tidak bisa dipetakan (elemen sudah tidak ada di layout ini{stats.missing.length ? `: ${stats.missing.slice(0, 3).join(", ")}` : ""}).</p>
              )}
            </div>

            {mode === "click" && data.fixedClicks.length > 0 && (
              <div className="card card-pad">
                <div className="k muted small">Elemen melayang (posisi tetap di layar)</div>
                <ul className="mini-list">{data.fixedClicks.map((f) => <li key={f.element}><span>{f.label}</span><b>{fmtInt(f.n)} klik</b></li>)}</ul>
              </div>
            )}

            {mode === "click" && (
              <div className="card card-pad">
                <div className="k muted small">Klik per elemen</div>
                <ul className="mini-list">
                  {[...data.elementTotals].sort((a, b) => b.n - a.n).slice(0, 10).map((e) => (
                    <li key={e.element}><span>{e.label}</span><b>{fmtInt(e.n)}</b></li>
                  ))}
                  {!data.elementTotals.length && <li className="muted">Belum ada.</li>}
                </ul>
                <div className="heat-legend"><span>sedikit</span><i /><span>banyak klik</span></div>
              </div>
            )}

            {mode === "attention" && (
              <div className="card card-pad">
                <div className="k muted small">Elemen paling menarik perhatian</div>
                <ul className="mini-list">
                  {data.hovers.slice(0, 10).map((h) => (
                    <li key={h.element}><span>{h.label}<small className="muted"> · ⌀ {fmtDuration(h.avg_ms)}</small></span><b>{fmtInt(h.n)}</b></li>
                  ))}
                  {!data.hovers.length && <li className="muted">Belum ada hover.</li>}
                </ul>
              </div>
            )}

            {mode === "scroll" && (
              <div className="card card-pad">
                <div className="k muted small">Scroll depth</div>
                <ul className="mini-list">
                  {[25, 50, 75, 90, 100].map((d) => {
                    const r = data.scroll.find((s) => s.depth === d)?.reached ?? 0;
                    return <li key={d}><span>{d}% halaman</span><b>{fmtPct(data.counts.pageviews ? r / data.counts.pageviews : null, 0)}</b></li>;
                  })}
                </ul>
                <p className="muted small mt-8">Persentase page view yang mencapai kedalaman tersebut (bagian bawah layar).</p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
