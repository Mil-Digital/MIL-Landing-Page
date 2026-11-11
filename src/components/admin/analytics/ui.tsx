"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/admin/Icon";
import { fmtPct } from "./charts";

/* ------------------------------------------------------------------ metric dictionary */
/** Every metric shown in the dashboard, with its definition and denominator (also in docs/ANALYTICS.md). */
export const METRICS: Record<string, { label: string; def: string; lowerIsBetter?: boolean }> = {
  totalVisitors: { label: "Total Visitors", def: "Pengunjung unik per hari, dijumlahkan untuk seluruh periode. Orang yang sama yang datang di 2 hari berbeda dihitung 2." },
  uniqueVisitors: { label: "Unique Visitors", def: "Jumlah browser/perangkat berbeda (ID pseudonim acak) dalam periode. Orang yang sama di 2 perangkat dihitung 2." },
  sessions: { label: "Total Sessions", def: "Jumlah kunjungan. Sesi baru dimulai setelah 30 menit tanpa aktivitas, atau saat pengunjung datang lewat kampanye (UTM) berbeda." },
  pageviews: { label: "Page Views", def: "Jumlah halaman yang dimuat. Refresh dihitung sebagai page view baru (tetap sesi & pengunjung yang sama)." },
  pagesPerSession: { label: "Pages / Session", def: "Page views ÷ sessions." },
  avgSession: { label: "Avg. Session Duration", def: "Rata-rata waktu aktif per sesi: tab terlihat dan tidak idle lebih dari 2 menit. Penyebut: semua sesi." },
  bounceRate: { label: "Bounce Rate", def: "Sesi tidak engaged ÷ semua sesi. Engaged = aktif ≥ 10 detik, atau ≥ 2 page view, atau ≥ 1 klik pada elemen yang dilacak.", lowerIsBetter: true },
  newVisitors: { label: "New Visitors", def: "Pengunjung yang pertama kali datang (sesi pertamanya) di periode ini." },
  returningVisitors: { label: "Returning Visitors", def: "Pengunjung yang pernah datang sebelumnya dan kembali di periode ini. Satu orang bisa masuk New dan Returning bila datang 2× di periode yang sama." },
  ctaClicks: { label: "Total CTA Clicks", def: "Klik pada tombol CTA (Hero, Closing CTA) dan tombol WhatsApp melayang." },
  clickRate: { label: "Overall Click Rate", def: "Sesi dengan ≥ 1 klik pada elemen yang dilacak ÷ semua sesi." },
  videoPlays: { label: "Total Video Plays", def: "Berapa kali video mulai diputar, termasuk putar ulang setelah selesai. Lanjut setelah pause tidak dihitung." },
  video3s: { label: "3-Second Video Plays", def: "Tayangan (per page view per video) yang diputar minimal 3 detik waktu putar nyata (pause & seek tidak dihitung)." },
  thruplays: { label: "ThruPlays", def: "Definisi Meta: ditonton minimal 15 detik, atau sampai selesai bila durasi video < 15 detik. Dihitung sekali per page view per video." },
  exposures: { label: "Exposures", def: "Page view di mana elemen terlihat minimal 50% di layar (dihitung sekali per page view)." },
  ctr: { label: "Click Rate (CTR)", def: "Sesi yang mengklik elemen ÷ sesi yang melihat elemen (exposure). Bukan dibagi total page views." },
  uniqueClicks: { label: "Unique Clicks", def: "Jumlah sesi yang mengklik elemen (klik berulang dalam satu sesi dihitung sekali)." },
  hover: { label: "Hover", def: "Kursor mouse berada di atas elemen ≥ 500 ms (hanya perangkat dengan mouse). Hover adalah indikator interaksi mouse, BUKAN bukti pengunjung benar-benar melihat area itu dengan mata." },
  engagement: { label: "Engagement", def: "Sesi yang mengklik atau hover elemen ÷ sesi yang melihat elemen." },
  impressions: { label: "Impressions", def: "Page view di mana video terlihat ≥ 50% di layar (sekali per page view)." },
  uniquePlays: { label: "Unique Plays", def: "Page view di mana video diputar (beberapa kali putar dalam satu page view = 1)." },
  playRate: { label: "Video Play Rate", def: "Impressions yang berlanjut diputar ÷ impressions." },
  rate3s: { label: "3-Second View Rate", def: "Unique plays yang mencapai 3 detik ÷ impressions." },
  thruplayRate: { label: "ThruPlay Rate", def: "Unique ThruPlays ÷ impressions." },
  completionRate: { label: "Completion Rate", def: "Unique completed views (video selesai) ÷ unique plays." },
  avgWatch: { label: "Average Watch Time", def: "Rata-rata waktu putar nyata per unique play (pause, buffering & seek tidak dihitung; putar ulang ikut dihitung)." },
  avgPct: { label: "Avg. % Watched", def: "Rata-rata titik terjauh yang dicapai dengan menonton (bukan dengan seek), dibagi durasi video. Per unique play." },
  milestone: { label: "Progress views", def: "Unique plays yang mencapai titik tersebut dengan menonton (melompat lewat seek tidak dihitung)." },
};

/* ------------------------------------------------------------------ info popover */
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  return (
    <span className="info" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="Penjelasan metric" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <Icon name="info" size={13} />
      </button>
      {open && <span className="info-pop" role="tooltip">{text}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ stat card */
export function Delta({ cur, prev, lowerIsBetter }: { cur: number | null; prev: number | null; lowerIsBetter?: boolean }) {
  if (cur === null || prev === null) return <span className="delta flat">—</span>;
  if (prev === 0) return <span className="delta flat" title="Tidak ada data di periode sebelumnya">{cur ? "baru" : "—"}</span>;
  const ch = (cur - prev) / prev;
  if (Math.abs(ch) < 0.0005) return <span className="delta flat">0%</span>;
  const good = lowerIsBetter ? ch < 0 : ch > 0;
  return (
    <span className={`delta ${good ? "good" : "bad"}`} title={`Periode sebelumnya: ${prev.toLocaleString("id-ID", { maximumFractionDigits: 2 })}`}>
      {ch > 0 ? "▲" : "▼"} {fmtPct(Math.abs(ch))}
    </span>
  );
}

export function Stat({ m, value, cur, prev, sub }: {
  m: keyof typeof METRICS | string; value: ReactNode; cur?: number | null; prev?: number | null; sub?: ReactNode;
}) {
  const def = METRICS[m];
  return (
    <div className="card stat astat">
      <div className="k">{def?.label ?? m}{def && <Info text={def.def} />}</div>
      <div className="v">{value}</div>
      <div className="s">
        {cur !== undefined && prev !== undefined ? <><Delta cur={cur ?? null} prev={prev ?? null} lowerIsBetter={def?.lowerIsBetter} /> <span className="muted">vs periode sebelumnya</span></> : sub}
      </div>
    </div>
  );
}

export function Panel({ title, sub, children, actions, info }: { title: string; sub?: ReactNode; children: ReactNode; actions?: ReactNode; info?: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2 className="row" style={{ gap: 6 }}>{title}{info && <Info text={info} />}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {actions}
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty a-empty">
      <Icon name="stats" />
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ data hook */
export type Query = { range: string; from: string; to: string; granularity: string; device: string; channel: string };

export function useAnalytics<T>(view: string, q: Query, extra: Record<string, string> = {}, enabled = true) {
  const [state, setState] = useState<{ data: T | null; meta: Meta | null; filters: Filters | null; loading: boolean; error: string | null }>({
    data: null, meta: null, filters: null, loading: true, error: null,
  });
  const key = JSON.stringify({ view, q, extra });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const p = new URLSearchParams({ view, range: q.range, granularity: q.granularity, device: q.device, channel: q.channel, ...extra });
    if (q.range === "custom") { p.set("from", q.from); p.set("to", q.to); }
    fetch(`/api/admin/analytics?${p}`, { cache: "no-store", signal: ctl.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.status === 401) window.location.href = "/admin/login?next=/admin/analytics";
        if (!r.ok) throw new Error(j.error || `Request gagal (${r.status})`);
        setState({ data: j.data, meta: j.meta, filters: j.filters, loading: false, error: null });
      })
      .catch((e) => { if (e.name !== "AbortError") setState((s) => ({ ...s, loading: false, error: e.message })); });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce, enabled]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}

export type Meta = {
  timezone: string; consentMode: string; enabled: boolean; retentionDays: number; sessionTimeoutMin: number;
  hoverMinMs: number; heatmapMinSample: number; currentLayout: string; role: string;
};
export type Filters = { range: string; from: string; to: string; device: string; channel: string; granularity: string; prev: { from: string; to: string } };

/** Short label for a time bucket. */
export function bucketLabel(t: string, g: string) {
  const d = new Date(t + ":00Z");
  const opt: Intl.DateTimeFormatOptions =
    g === "hour" ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
    : g === "month" ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "numeric", month: "short", timeZone: "UTC" };
  return d.toLocaleString("id-ID", opt);
}

export function Loading() {
  return <div className="a-loading"><span className="spinner" /> Memuat data…</div>;
}
export function ErrorBox({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="alert error row between">
      <span>Gagal memuat analytics: {error}</span>
      <button className="btn sm" onClick={onRetry}>Coba lagi</button>
    </div>
  );
}
