"use client";
import { useState } from "react";
import { Icon } from "@/components/admin/Icon";

const DEVICES = [
  { k: "desktop", label: "Desktop", w: 1440, icon: "monitor" },
  { k: "laptop", label: "Laptop", w: 1180, icon: "monitor" },
  { k: "tablet", label: "Tablet", w: 820, icon: "tablet" },
  { k: "mobile", label: "Mobile", w: 390, icon: "phone" },
] as const;

export default function DevicesPage() {
  const [d, setD] = useState<(typeof DEVICES)[number]>(DEVICES[3]);
  const [src, setSrc] = useState<"draft" | "live">("draft");
  const [n, setN] = useState(0);
  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1>Preview responsif</h1>
          <p>Cek tampilan draft atau website live di berbagai ukuran layar sebelum mempublikasikan.</p>
        </div>
      </div>
      <div className="device-bar">
        <div className="seg">
          {DEVICES.map((x) => (
            <button key={x.k} className={d.k === x.k ? "on" : ""} onClick={() => setD(x)}>
              <span className="row" style={{ gap: 6 }}><Icon name={x.icon} size={14} /> {x.label}</span>
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={src === "draft" ? "on" : ""} onClick={() => setSrc("draft")}>Draft</button>
          <button className={src === "live" ? "on" : ""} onClick={() => setSrc("live")}>Live</button>
        </div>
        <button className="btn sm" onClick={() => setN(n + 1)}><Icon name="refresh" /> Muat ulang</button>
        <span className="muted">{d.w}px</span>
      </div>
      <div className="device-stage">
        <iframe key={`${src}-${n}`} title="Preview" src={src === "draft" ? "/admin/preview" : "/"} style={{ width: d.w }} />
      </div>
    </div>
  );
}
