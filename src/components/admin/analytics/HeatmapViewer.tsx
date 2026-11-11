"use client";
/**
 * Heatmap viewer: loads the LIVE landing page (same origin) in an iframe at the device's width
 * and injects an overlay into the page document. Every data point is anchored to the element
 * (data-analytics-id) or section (data-analytics-section) it was recorded on, so positions stay
 * correct across screen sizes and responsive re-flows. The tracker does not run inside iframes,
 * so viewing heatmaps never creates analytics data.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDuration, fmtInt, fmtPct } from "./charts";

export type HeatData = {
  bucket: "desktop" | "tablet" | "mobile";
  counts: { pageviews: number; clicks: number; hovers: number };
  elementClicks: { element: string; rx: number; ry: number; n: number }[];
  freeClicks: { section: string; sx: number; sy: number; n: number }[];
  fixedClicks: { element: string; label: string; n: number }[];
  hovers: { element: string; label: string; n: number; sessions: number; avg_ms: number; total_ms: number }[];
  elementTotals: { element: string; label: string; n: number }[];
  scroll: { depth: number; reached: number }[];
  sections: { section: string; reached: number }[];
};
export type HeatMode = "click" | "attention" | "scroll";

export const DEVICE_FRAME = {
  desktop: { w: 1440, h: 900, label: "Desktop" },
  tablet: { w: 820, h: 1180, label: "Tablet" },
  mobile: { w: 390, h: 844, label: "Mobile" },
} as const;

const SECTION_LABEL: Record<string, string> = {
  hero: "Hero", clients: "Brand Statistics", workflow: "MIL Workflow", services: "Services",
  testimonials: "Testimonials", cta: "Closing CTA", footer: "Footer",
};

type Stats = { mapped: number; unmapped: number; missing: string[] };

export function HeatmapViewer({ data, mode, showCounts, onStats }: {
  data: HeatData; mode: HeatMode; showCounts: boolean; onStats?: (s: Stats) => void;
}) {
  const frame = DEVICE_FRAME[data.bucket];
  const stageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [stageW, setStageW] = useState(900);
  const [loaded, setLoaded] = useState(0);
  const stageH = typeof window !== "undefined" ? Math.max(480, Math.round(window.innerHeight * 0.74)) : 700;
  const scale = Math.min(1, (stageW - 2) / frame.w);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    const win = doc.defaultView!;
    doc.getElementById("mil-heat")?.remove();
    const docW = doc.documentElement.clientWidth;
    const docH = Math.min(doc.documentElement.scrollHeight, 30000);
    const host = doc.createElement("div");
    host.id = "mil-heat";
    host.style.cssText = `position:absolute;left:0;top:0;width:${docW}px;height:${docH}px;z-index:2147483000;pointer-events:auto;cursor:default;font:500 12px/1.3 system-ui,-apple-system,sans-serif`;
    // keep the page from reacting to clicks while still letting the admin scroll
    host.addEventListener("click", (e) => e.preventDefault());
    doc.body.appendChild(host);
    if (win.getComputedStyle(doc.body).position === "static") doc.body.style.position = "relative";

    const abs = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + win.scrollX, y: r.top + win.scrollY, w: r.width, h: r.height };
    };
    const find = (id: string) => {
      const el = doc.querySelector(`[data-analytics-id="${CSS.escape(id)}"]`);
      if (!el) return null;
      const b = abs(el);
      return b.w > 0 && b.h > 0 ? b : null;
    };
    const findSection = (id: string) => {
      const el = doc.querySelector(`[data-analytics-section="${CSS.escape(id)}"]`);
      return el ? abs(el) : null;
    };
    const badge = (x: number, y: number, text: string, title: string) => {
      const b = doc.createElement("div");
      b.textContent = text;
      b.title = title;
      b.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-100%);background:#16171a;color:#fff;padding:3px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.3)`;
      host.appendChild(b);
    };
    const box = (b: { x: number; y: number; w: number; h: number }, style: string, title: string) => {
      const d = doc.createElement("div");
      d.title = title;
      d.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;border-radius:8px;${style}`;
      host.appendChild(d);
    };

    let mapped = 0, unmapped = 0;
    const missing = new Set<string>();

    if (mode === "click") {
      const pts: { x: number; y: number; n: number }[] = [];
      for (const c of data.elementClicks) {
        const b = find(c.element);
        if (!b) { unmapped += c.n; missing.add(c.element); continue; }
        pts.push({ x: b.x + Number(c.rx) * b.w, y: b.y + Number(c.ry) * b.h, n: c.n });
        mapped += c.n;
      }
      for (const c of data.freeClicks) {
        const s = findSection(c.section);
        if (!s) { unmapped += c.n; continue; }
        pts.push({ x: Number(c.sx) * docW, y: s.y + Number(c.sy) * s.h, n: c.n });
        mapped += c.n;
      }
      host.appendChild(heatCanvas(doc, docW, docH, pts));
      if (showCounts) {
        const total = data.counts.clicks || 1;
        for (const t of data.elementTotals) {
          const b = find(t.element);
          if (!b) continue;
          box(b, "outline:1.5px dashed rgba(22,23,26,.55);outline-offset:2px", t.label);
          badge(b.x + b.w / 2, b.y - 6, `${fmtInt(t.n)} klik · ${fmtPct(t.n / total)}`, t.label);
        }
      }
    } else if (mode === "attention") {
      const max = Math.max(1, ...data.hovers.map((h) => h.total_ms));
      for (const h of data.hovers) {
        const b = find(h.element);
        if (!b) { unmapped += h.n; missing.add(h.element); continue; }
        mapped += h.n;
        const a = 0.12 + 0.6 * (h.total_ms / max);
        box(b, `background:rgba(235,104,52,${a.toFixed(2)});outline:2px solid rgba(201,60,20,${Math.min(1, a + 0.2).toFixed(2)})`,
          `${h.label}\n${fmtInt(h.n)} hover · rata-rata ${fmtDuration(h.avg_ms)}`);
        if (showCounts) badge(b.x + b.w / 2, b.y - 6, `${fmtInt(h.n)} hover · ⌀ ${fmtDuration(h.avg_ms)}`, h.label);
      }
    } else {
      const pv = data.counts.pageviews || 1;
      const reachAt = (pct: number) => {
        // fraction of page views whose deepest visible point reached pct% of the page
        const lo = data.scroll.filter((s) => s.depth <= pct).at(-1), hi = data.scroll.find((s) => s.depth >= pct);
        if (!lo || !hi) return 0;
        if (hi.depth === lo.depth) return lo.reached / pv;
        const t = (pct - lo.depth) / (hi.depth - lo.depth);
        return (lo.reached + (hi.reached - lo.reached) * t) / pv;
      };
      const c = doc.createElement("canvas");
      c.width = 1; c.height = 200;
      c.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:auto";
      const g = c.getContext("2d")!;
      for (let i = 0; i < 200; i++) {
        const f = reachAt((i / 199) * 100);
        g.fillStyle = `rgba(16,24,48,${(0.72 * (1 - f)).toFixed(3)})`;
        g.fillRect(0, i, 1, 1);
      }
      host.appendChild(c);
      for (const target of [0.75, 0.5, 0.25]) {
        let pct = -1;
        for (let p = 0; p <= 100; p += 0.5) if (reachAt(p) < target) { pct = p; break; }
        if (pct < 0) continue;
        const y = (pct / 100) * docH;
        const line = doc.createElement("div");
        line.style.cssText = `position:absolute;left:0;right:0;top:${y}px;border-top:2px dashed #fff;opacity:.9`;
        host.appendChild(line);
        const tag = doc.createElement("div");
        tag.textContent = `${Math.round(target * 100)}% pengunjung sampai sini`;
        tag.style.cssText = `position:absolute;right:12px;top:${y + 6}px;background:#16171a;color:#fff;padding:4px 8px;border-radius:6px`;
        host.appendChild(tag);
      }
      for (const s of doc.querySelectorAll("[data-analytics-section]")) {
        const id = s.getAttribute("data-analytics-section")!;
        const b = abs(s);
        const reached = data.sections.find((x) => x.section === id)?.reached ?? 0;
        const tag = doc.createElement("div");
        tag.textContent = `${SECTION_LABEL[id] ?? id}: ${fmtPct(reached / pv, 0)} melihat`;
        tag.title = "Persentase page view di mana section ini terlihat (≥30% section atau ≥50% layar)";
        tag.style.cssText = `position:absolute;left:12px;top:${b.y + 10}px;background:rgba(255,255,255,.95);color:#16171a;padding:4px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.25)`;
        host.appendChild(tag);
      }
      mapped = data.counts.pageviews;
    }
    onStats?.({ mapped, unmapped, missing: [...missing] });
  }, [data, mode, showCounts, onStats]);

  // redraw when data/mode change and whenever the page re-flows (fonts, lazy images, resize)
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!loaded || !doc?.body) return;
    draw();
    let t: ReturnType<typeof setTimeout>;
    let lastH = doc.documentElement.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = doc.documentElement.scrollHeight;
      if (Math.abs(h - lastH) < 4) return;
      lastH = h;
      clearTimeout(t);
      t = setTimeout(draw, 250);
    });
    // observe the page content, not the overlay
    for (const el of doc.querySelectorAll("body > header, body > section, body > footer")) ro.observe(el);
    const late = setTimeout(draw, 1500);
    return () => { ro.disconnect(); clearTimeout(t); clearTimeout(late); };
  }, [loaded, draw]);

  const onLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    // static preview: stop autoplaying animations from shifting content; pause videos
    doc.querySelectorAll("video").forEach((v) => v.pause());
    (doc.fonts?.ready ?? Promise.resolve()).then(() => setLoaded((n) => n + 1));
  };

  return (
    <div className="heat-stage" ref={stageRef} style={{ height: stageH + 2 }}>
      <div style={{ width: frame.w * scale, height: stageH, overflow: "hidden", margin: "0 auto", borderRadius: 10, boxShadow: "var(--shadow-lg)", background: "#fff" }}>
        <iframe
          ref={iframeRef}
          key={data.bucket}
          title={`Heatmap ${frame.label}`}
          src={`/?mil_heatmap=${data.bucket}`}
          onLoad={onLoad}
          style={{ width: frame.w, height: stageH / scale, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0", display: "block" }}
        />
      </div>
    </div>
  );
}

/** Classic heatmap: accumulate soft circles in alpha, then colour by intensity (single warm hue). */
function heatCanvas(doc: Document, w: number, h: number, pts: { x: number; y: number; n: number }[]) {
  const c = doc.createElement("canvas");
  c.width = w; c.height = h;
  c.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;pointer-events:none`;
  if (!pts.length) return c;
  const g = c.getContext("2d")!;
  const max = Math.max(...pts.map((p) => p.n));
  const R = Math.max(18, Math.min(40, w / 40));
  for (const p of pts) {
    const grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
    const a = Math.min(1, 0.25 + 0.75 * (p.n / max));
    grd.addColorStop(0, `rgba(0,0,0,${a})`);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(p.x - R, p.y - R, R * 2, R * 2);
  }
  // colorize only the touched area
  const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - R)), maxX = Math.min(w, Math.ceil(Math.max(...pts.map((p) => p.x)) + R));
  const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y)) - R)), maxY = Math.min(h, Math.ceil(Math.max(...pts.map((p) => p.y)) + R));
  if (maxX <= minX || maxY <= minY) return c;
  const img = g.getImageData(minX, minY, maxX - minX, maxY - minY);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (!a) continue;
    // low → light orange, high → deep red-orange (one hue family, darker = more clicks)
    d[i] = Math.round(253 - 80 * a);
    d[i + 1] = Math.round(186 - 150 * a);
    d[i + 2] = Math.round(116 - 96 * a);
    d[i + 3] = Math.round(255 * Math.min(0.85, 0.2 + a * 0.8));
  }
  g.putImageData(img, minX, minY);
  return c;
}
