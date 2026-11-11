"use client";
import { useEffect, useState } from "react";
import { CHANNEL_LABELS } from "@/lib/analytics/classify";
import { Icon } from "@/components/admin/Icon";
import { OverviewTab, TrafficTab } from "@/components/admin/analytics/TrafficTabs";
import { InteractionsTab } from "@/components/admin/analytics/InteractionsTab";
import { HeatmapsTab } from "@/components/admin/analytics/HeatmapsTab";
import { VideoTab } from "@/components/admin/analytics/VideoTab";
import { PrivacyTab } from "@/components/admin/analytics/PrivacyTab";
import { useAnalytics, type Query } from "@/components/admin/analytics/ui";

const TABS = [
  { k: "overview", label: "Overview" },
  { k: "traffic", label: "Traffic" },
  { k: "clicks", label: "Clicks & Interactions" },
  { k: "heatmaps", label: "Heatmaps" },
  { k: "video", label: "Video Analytics" },
  { k: "privacy", label: "Data & Privasi" },
] as const;
type Tab = (typeof TABS)[number]["k"];

const RANGES = [
  { k: "today", label: "Hari ini" },
  { k: "yesterday", label: "Kemarin" },
  { k: "7d", label: "7 hari terakhir" },
  { k: "30d", label: "30 hari terakhir" },
  { k: "90d", label: "90 hari terakhir" },
  { k: "custom", label: "Rentang kustom" },
];

const STORE = "mil_cms_analytics_filters";

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState<Query>({ range: "7d", from: "", to: "", granularity: "auto", device: "", channel: "" });
  const [ready, setReady] = useState(false);

  // restore tab (URL) + filters (per-browser convenience), and exclude this browser from tracking
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && typeof saved === "object") setQ((x) => ({ ...x, ...saved }));
    } catch { /* storage unavailable */ }
    const t = new URLSearchParams(location.search).get("tab") as Tab | null;
    if (t && TABS.some((x) => x.k === t)) setTab(t);
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(STORE, JSON.stringify(q)); } catch { /* ignore */ }
  }, [q, ready]);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", t === "overview" ? location.pathname : `?tab=${t}`);
  };

  const meta = useAnalytics<unknown>("overview", { ...q, range: "today", granularity: "day" }, {}, ready && tab === "privacy");
  const set = (patch: Partial<Query>) => setQ((x) => ({ ...x, ...patch }));
  const today = new Date().toISOString().slice(0, 10);

  const custom = q.range === "custom";
  const effective: Query = custom && !(q.from && q.to) ? { ...q, range: "7d" } : q;

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p>Traffic, interaksi, heatmap, dan performa video website — dari data pengunjung yang sebenarnya.</p>
        </div>
        <div className="actions">
          <a className="btn" href="/" target="_blank" rel="noopener"><Icon name="globe" /> Lihat website</a>
        </div>
      </div>

      <nav className="a-tabs" role="tablist" aria-label="Analytics">
        {TABS.map((t) => (
          <button key={t.k} role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => go(t.k)}>{t.label}</button>
        ))}
      </nav>

      {tab !== "privacy" && (
        <div className="a-filters">
          <select className="select sm-select" value={q.range} onChange={(e) => set({ range: e.target.value, ...(e.target.value === "custom" && !q.from ? { from: shift(today, -29), to: today } : {}) })} aria-label="Periode">
            {RANGES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
          {custom && (
            <span className="row" style={{ gap: 6 }}>
              <input type="date" className="input sm-select" value={q.from} max={q.to || today} onChange={(e) => set({ from: e.target.value })} aria-label="Dari" />
              <span className="muted">–</span>
              <input type="date" className="input sm-select" value={q.to} min={q.from} max={today} onChange={(e) => set({ to: e.target.value })} aria-label="Sampai" />
            </span>
          )}
          {tab !== "heatmaps" && tab !== "video" && (
            <div className="seg" role="group" aria-label="Interval grafik">
              {[["auto", "Auto"], ["day", "Harian"], ["week", "Mingguan"], ["month", "Bulanan"]].map(([k, l]) => (
                <button key={k} className={q.granularity === k ? "on" : ""} onClick={() => set({ granularity: k })}>{l}</button>
              ))}
            </div>
          )}
          {tab !== "heatmaps" && (
            <select className="select sm-select" value={q.device} onChange={(e) => set({ device: e.target.value })} aria-label="Device">
              <option value="">Semua device</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
          )}
          <select className="select sm-select" value={q.channel} onChange={(e) => set({ channel: e.target.value })} aria-label="Sumber traffic">
            <option value="">Semua sumber</option>
            {Object.entries(CHANNEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {(q.device || q.channel) && <button className="btn sm ghost" onClick={() => set({ device: "", channel: "" })}><Icon name="x" /> Reset filter</button>}
        </div>
      )}

      {ready && (
        <div role="tabpanel">
          {tab === "overview" && <OverviewTab q={effective} />}
          {tab === "traffic" && <TrafficTab q={effective} />}
          {tab === "clicks" && <InteractionsTab q={effective} />}
          {tab === "heatmaps" && <HeatmapsTab q={effective} />}
          {tab === "video" && <VideoTab q={effective} />}
          {tab === "privacy" && <PrivacyTab meta={meta.meta} />}
        </div>
      )}
    </div>
  );
}

function shift(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
