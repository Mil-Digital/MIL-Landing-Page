"use client";
import { useEffect, useRef, useState } from "react";
import { formatBytes, listAssets, uploadAsset, type MediaAsset } from "@/lib/media";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

export function Thumb({ url, kind, tall, dark, poster, small }: { url?: string; kind: "image" | "video"; tall?: boolean; dark?: boolean; poster?: string; small?: boolean }) {
  return (
    <div className={`media-thumb${tall ? " tall" : ""}${dark ? " dark" : ""}${small ? " small" : ""}`}>
      {url ? (
        kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" />
        ) : (
          <video src={url} poster={poster} muted preload="metadata" playsInline />
        )
      ) : (
        <Icon name={kind === "image" ? "image" : "film"} />
      )}
    </div>
  );
}

/** Choose an existing asset from the library or upload a new one. */
export function MediaPicker({ kind, onPick, onClose }: { kind: "image" | "video"; onPick: (a: MediaAsset) => void; onClose: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [sel, setSel] = useState<MediaAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listAssets(kind)
      .then(setItems)
      .catch((e) => { toast("error", "Gagal memuat media", e.message); setItems([]); });
  }, [kind, toast]);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const a = await uploadAsset(f, kind);
      toast("success", "File diunggah", a.file_name);
      onPick(a);
    } catch (e) {
      toast("error", "Upload gagal", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const list = (items ?? []).filter((a) => !q || a.file_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal
      title={kind === "image" ? "Pilih gambar" : "Pilih video"}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn primary" disabled={!sel} onClick={() => sel && onPick(sel)}>
            <Icon name="check" /> Gunakan file ini
          </button>
        </>
      }
    >
      <div className="row wrap-gap">
        <input className="input" style={{ flex: 1, minWidth: 180 }} placeholder="Cari nama file…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input ref={input} type="file" hidden accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : "video/mp4,video/webm,video/quicktime"} onChange={(e) => upload(e.target.files?.[0])} />
        <button className="btn accent" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <span className="spinner" /> : <Icon name="upload" />} Upload baru
        </button>
      </div>
      {busy && <div className="progress"><i /></div>}
      {items === null ? (
        <div className="empty">Memuat…</div>
      ) : list.length === 0 ? (
        <div className="empty">
          <Icon name={kind === "image" ? "image" : "film"} />
          <div>Belum ada {kind === "image" ? "gambar" : "video"} di Media Library. Upload file baru.</div>
        </div>
      ) : (
        <div className="media-grid">
          {list.map((a) => (
            <div key={a.id} className={`card m-card pick${sel?.id === a.id ? " selected" : ""}`} onClick={() => setSel(a)} onDoubleClick={() => onPick(a)}>
              <div className="pv"><Thumb url={a.public_url} kind={kind} /></div>
              <div className="info">
                <div className="n" title={a.file_name}>{a.file_name}</div>
                <div className="d">
                  {formatBytes(a.size_bytes)}
                  {a.width ? ` · ${a.width}×${a.height}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
