"use client";
/**
 * Small dependency-free SVG charts for the analytics dashboard.
 * Specs: 2px lines, ≤24px bars with 4px rounded data-end, hairline grid, legend for ≥2 series,
 * hover tooltips, colors assigned per entity in a fixed order (never by rank).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const CHANNEL_COLOR: Record<string, string> = {
  direct: SERIES[0], organic: SERIES[1], social: SERIES[2], referral: SERIES[3], paid: SERIES[4], email: SERIES[5], other: SERIES[6],
};
export const DEVICE_COLOR: Record<string, string> = { desktop: SERIES[0], mobile: SERIES[1], tablet: SERIES[2] };

const nf = new Intl.NumberFormat("id-ID");
export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : nf.format(Math.round(n)));
export const fmtCompact = (n: number) =>
  Math.abs(n) >= 10_000 ? new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n) : nf.format(Math.round(n));
export const fmtPct = (r: number | null | undefined, digits = 1) =>
  r === null || r === undefined || !isFinite(r) ? "—" : `${(r * 100).toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: r > 0 && r < 0.1 ? Math.min(1, digits) : 0 })}%`;
export function fmtDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || !isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}d`;
  return `${Math.floor(m / 60)}j ${m % 60}m`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="viz-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="sw" style={{ background: i.color }} />
          {i.label}
          {i.value !== undefined && <b>{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ line chart */
export type LineSeries = { key: string; label: string; color: string; values: number[] };

export function LineChart({ labels, series, height = 240, format = fmtInt }: {
  labels: string[]; series: LineSeries[]; height?: number; format?: (n: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 44, r: 14, t: 12, b: 26 };
  const W = width, H = height, iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round((px / r.width) * (n - 1)))));
  };

  return (
    <div className="viz" ref={ref}>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      <div style={{ position: "relative" }}>
        <svg width={W} height={H} role="img" aria-label={series.map((s) => s.label).join(", ")}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="viz-grid" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{fmtCompact(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % every === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="viz-tick">{l}</text>
          ))}
          {series.map((s) => (
            <g key={s.key}>
              {series.length === 1 && (
                <path d={`M${x(0)},${y(0)} ${s.values.map((v, i) => `L${x(i)},${y(v)}`).join(" ")} L${x(n - 1)},${y(0)} Z`} fill={s.color} opacity={0.1} />
              )}
              <path d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {n === 1 && <circle cx={x(0)} cy={y(s.values[0])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />}
            </g>
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="viz-cross" />
              {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />)}
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null && (
          <div className="viz-tip" style={{ left: Math.min(x(hover) + 12, W - 180), top: pad.t }}>
            <b>{labels[hover]}</b>
            {series.map((s) => (
              <div key={s.key} className="row between" style={{ gap: 14 }}>
                <span className="row" style={{ gap: 6 }}><span className="sw" style={{ background: s.color }} />{s.label}</span>
                <b>{format(s.values[hover])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ donut */
export function Donut({ items, center, size = 168 }: {
  items: { key: string; label: string; value: number; color: string }[]; center?: ReactNode; size?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((a, b) => a + b.value, 0);
  const R = size / 2, r = R - 22;
  let acc = 0;
  const arcs = items.filter((i) => i.value > 0).map((i) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += i.value;
    const a1 = (acc / total) * Math.PI * 2;
    return { ...i, a0, a1 };
  });
  const pt = (a: number, rad: number) => [R + rad * Math.sin(a), R - rad * Math.cos(a)];
  const arcPath = (a0: number, a1: number) => {
    if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
    const [x0, y0] = pt(a0, R - 2), [x1, y1] = pt(a1, R - 2), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x0},${y0} A${R - 2},${R - 2} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
  };
  const h = arcs.find((a) => a.key === hover);
  return (
    <div className="donut-wrap">
      <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <svg width={size} height={size} role="img" aria-label={items.map((i) => `${i.label} ${i.value}`).join(", ")}>
          {total === 0 && <circle cx={R} cy={R} r={(R - 2 + r) / 2} fill="none" stroke="#ececef" strokeWidth={R - 2 - r} />}
          {arcs.map((a) => (
            <path key={a.key} d={arcPath(a.a0, a.a1)} fill={a.color} stroke="#fff" strokeWidth={2}
              opacity={hover && hover !== a.key ? 0.45 : 1} onPointerEnter={() => setHover(a.key)} onPointerLeave={() => setHover(null)} />
          ))}
        </svg>
        <div className="donut-center">
          {h ? (<><b>{fmtPct(h.value / total)}</b><span>{h.label}</span></>) : center}
        </div>
      </div>
      <Legend items={items.map((i) => ({ label: i.label, color: i.color, value: total ? fmtPct(i.value / total) : "—" }))} />
    </div>
  );
}

/* ------------------------------------------------------------------ horizontal bars */
export function BarList({ items, format = fmtInt, color = SERIES[0], empty = "Belum ada data" }: {
  items: { label: ReactNode; value: number; sub?: ReactNode; color?: string; title?: string }[];
  format?: (n: number) => string; color?: string; empty?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="viz-empty">{empty}</div>;
  return (
    <ul className="barlist">
      {items.map((i, k) => (
        <li key={k} title={i.title}>
          <div className="bl-top">
            <span className="bl-label">{i.label}</span>
            <b>{format(i.value)}</b>
          </div>
          <div className="bl-track"><i style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? color }} /></div>
          {i.sub && <div className="bl-sub">{i.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ columns (retention / funnel) */
export function Columns({ items, height = 220, color = SERIES[0] }: {
  items: { label: string; value: number; display: string; note?: string }[]; height?: number; color?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 8, t: 22, b: 40 };
  const iw = width - pad.l - pad.r, ih = height - pad.t - pad.b;
  const slot = iw / Math.max(1, items.length);
  const bw = Math.min(24, slot * 0.5);
  const y = (v: number) => pad.t + ih - v * ih;
  return (
    <div className="viz" ref={ref} style={{ position: "relative" }}>
      <svg width={width} height={height} role="img" aria-label={items.map((i) => `${i.label} ${i.display}`).join(", ")}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="viz-grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="viz-tick">{t * 100}%</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = pad.l + slot * i + slot / 2, top = y(Math.max(0, Math.min(1, it.value)));
          const h = pad.t + ih - top;
          const r = Math.min(4, h);
          return (
            <g key={it.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
              {h > 0 && <path d={`M${cx - bw / 2},${pad.t + ih} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${pad.t + ih} Z`} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />}
              <text x={cx} y={top - 6} textAnchor="middle" className="viz-val">{it.display}</text>
              <text x={cx} y={height - 22} textAnchor="middle" className="viz-tick">{it.label}</text>
              {it.note && <text x={cx} y={height - 8} textAnchor="middle" className="viz-tick muted-tick">{it.note}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ simple sortable table */
export type Col<T> = { key: string; label: ReactNode; render: (r: T) => ReactNode; sort?: (r: T) => number | string; num?: boolean; title?: string };

export function DataTable<T>({ rows, cols, initialSort, empty = "Belum ada data untuk periode ini.", limit }: {
  rows: T[]; cols: Col<T>[]; initialSort?: string; empty?: string; limit?: number;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ? { key: initialSort, dir: -1 } : null);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort?.key);
    if (!c?.sort || !sort) return rows;
    return [...rows].sort((a, b) => {
      const va = c.sort!(a), vb = c.sort!(b);
      return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
    });
  }, [rows, cols, sort]);
  if (!rows.length) return <div className="viz-empty">{empty}</div>;
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;
  return (
    <div className="table-wrap">
      <table className="dtable">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.num ? "num" : ""} title={c.title}>
                {c.sort ? (
                  <button onClick={() => setSort({ key: c.key, dir: sort?.key === c.key ? (sort.dir === 1 ? -1 : 1) : -1 })}>
                    {c.label}{sort?.key === c.key ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c.key} className={c.num ? "num" : ""}>{c.render(r)}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {limit && rows.length > limit && (
        <button className="btn sm ghost mt-8" onClick={() => setAll(!all)}>{all ? "Tampilkan lebih sedikit" : `Tampilkan semua (${rows.length})`}</button>
      )}
    </div>
  );
}
