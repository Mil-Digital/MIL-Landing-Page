"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SECTIONS } from "@/content/schema";
import { useCms } from "@/components/admin/CmsContext";
import { Icon } from "@/components/admin/Icon";
import { Modal } from "@/components/admin/Modal";
import { Thumb } from "@/components/admin/MediaPicker";
import { useToast } from "@/components/admin/Toast";
import { deleteAsset, formatBytes, listAssets, migrateBundledAsset, replaceAsset, uploadAsset, usageOf, type MediaAsset } from "@/lib/media";

const label = (id: string) => SECTIONS.find((s) => s.id === id)?.label ?? id;

export default function MediaPage() {
  const toast = useToast();
  const { rows, refresh } = useCms();
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [view, setView] = useState<MediaAsset | null>(null);
  const upInput = useRef<HTMLInputElement>(null);
  const repInput = useRef<HTMLInputElement>(null);
  const repTarget = useRef<MediaAsset | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listAssets());
    } catch (e) {
      toast("error", "Gagal memuat media", (e as Error).message);
      setItems([]);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const uploadMany = async (files: FileList | File[] | null | undefined) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy("upload");
    let ok = 0;
    for (const f of list) {
      try {
        await uploadAsset(f);
        ok++;
      } catch (e) {
        toast("error", `Gagal: ${f.name}`, (e as Error).message);
      }
    }
    setBusy(null);
    if (ok) toast("success", `${ok} file diunggah`);
    load();
  };

  const startReplace = (a: MediaAsset) => {
    repTarget.current = a;
    repInput.current?.click();
  };
  const doReplace = async (f?: File) => {
    const a = repTarget.current;
    if (!f || !a) return;
    setBusy(a.id);
    try {
      const { updatedFields } = await replaceAsset(a, f);
      toast("success", "File diganti", updatedFields ? `${updatedFields} isian draft diperbarui. Klik Publish untuk menerapkan di website.` : "File belum dipakai di konten.");
      await Promise.all([load(), refresh()]);
    } catch (e) {
      toast("error", "Gagal mengganti file", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async (a: MediaAsset) => {
    if (!window.confirm(`Hapus “${a.file_name}” secara permanen?`)) return;
    setBusy(a.id);
    try {
      await deleteAsset(a);
      toast("success", "File dihapus");
      setItems((x) => x?.filter((y) => y.id !== a.id) ?? null);
    } catch (e) {
      toast("error", "Gagal menghapus", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Original assets bundled with the site (/assets/…) that the draft still points to.
  const bundled = useMemo(() => {
    const set = new Set<string>();
    JSON.stringify(rows.map((r) => r.draft_value)).replace(/"(\/assets\/[^"]+)"/g, (m, u) => (set.add(u), m));
    return [...set].sort();
  }, [rows]);

  const migrate = async (urls: string[]) => {
    setBusy("migrate");
    let ok = 0;
    for (const u of urls) {
      try {
        await migrateBundledAsset(u);
        ok++;
      } catch (e) {
        toast("error", `Gagal memindahkan ${u}`, (e as Error).message);
      }
    }
    setBusy(null);
    if (ok) toast("success", `${ok} file dipindahkan ke Neon Object Storage`, "Draft sudah diperbarui — klik Publish untuk menerapkan.");
    await Promise.all([load(), refresh()]);
  };

  const list = (items ?? []).filter((a) => (filter === "all" || a.kind === filter) && (!q || a.file_name.toLowerCase().includes(q.toLowerCase())));
  const totalSize = (items ?? []).reduce((n, a) => n + (a.size_bytes || 0), 0);

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1>Media Library</h1>
          <p>Semua gambar dan video website, disimpan di Neon Object Storage. File yang sedang dipakai tidak dapat dihapus.</p>
        </div>
        <div className="actions">
          <input ref={upInput} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime" onChange={(e) => { uploadMany(e.target.files); e.target.value = ""; }} />
          <input ref={repInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif,image/gif,video/mp4,video/webm,video/quicktime" onChange={(e) => { doReplace(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn primary" onClick={() => upInput.current?.click()} disabled={!!busy}>
            {busy === "upload" ? <span className="spinner" /> : <Icon name="upload" />} Upload file
          </button>
        </div>
      </div>

      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); uploadMany(e.dataTransfer.files); }}
      >
        <b>Tarik & lepas file ke sini</b> untuk mengunggah · Gambar JPG/PNG/WebP/AVIF maks. 10 MB · Video MP4/WebM/MOV maks. 50 MB
        {busy === "upload" && <div className="progress mt-8"><i /></div>}
      </div>

      {bundled.length > 0 && (
        <div className="card mt-16">
          <div className="card-head">
            <div>
              <h2>File original (bawaan website)</h2>
              <p>File dari landing page original yang masih dipakai konten. Pindahkan ke Neon Object Storage agar bisa dikelola & diganti dari sini.</p>
            </div>
            <button className="btn sm accent" onClick={() => migrate(bundled)} disabled={!!busy}>
              {busy === "migrate" ? <span className="spinner" /> : <Icon name="upload" />} Pindahkan semua ({bundled.length})
            </button>
          </div>
          <ul className="list">
            {bundled.map((u) => {
              const use = usageOf(u, rows);
              return (
                <li key={u}>
                  <Thumb small url={u.endsWith(".mp4") ? undefined : u} kind={u.endsWith(".mp4") ? "video" : "image"} dark={/logo|client/.test(u)} />
                  <div className="grow">
                    <div className="title mono">{u}</div>
                    <div className="sub">{[...new Set([...use.live, ...use.draft])].map(label).join(", ")}</div>
                  </div>
                  <button className="btn sm" onClick={() => migrate([u])} disabled={!!busy}>Pindahkan</button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="media-toolbar mt-24">
        <div className="seg" role="tablist">
          {(["all", "image", "video"] as const).map((k) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)} role="tab" aria-selected={filter === k}>
              {k === "all" ? "Semua" : k === "image" ? "Gambar" : "Video"}
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Cari nama file…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ marginLeft: "auto" }}>{items?.length ?? 0} file · {formatBytes(totalSize)}</span>
      </div>

      {items === null ? (
        <div className="progress"><i /></div>
      ) : list.length === 0 ? (
        <div className="card empty">
          <Icon name="media" />
          <div>{items.length ? "Tidak ada file yang cocok." : "Belum ada file. Upload gambar atau video pertama Anda."}</div>
        </div>
      ) : (
        <div className="media-grid">
          {list.map((a) => {
            const use = usageOf(a.public_url, rows);
            const isBusy = busy === a.id;
            return (
              <div key={a.id} className="card m-card">
                <div className="pv" onClick={() => setView(a)} style={{ cursor: "zoom-in" }}>
                  <Thumb url={a.public_url} kind={a.kind === "video" ? "video" : "image"} />
                  <span className="badge plain kind">{a.kind === "video" ? "Video" : "Gambar"}</span>
                </div>
                <div className="info">
                  <div className="n" title={a.file_name}>{a.file_name}</div>
                  <div className="d">
                    {a.mime_type.split("/")[1]?.toUpperCase()} · {formatBytes(a.size_bytes)}
                    {a.width ? ` · ${a.width}×${a.height}` : ""}
                    {a.duration_seconds ? ` · ${Math.round(a.duration_seconds)} dtk` : ""}
                  </div>
                  <div className="use">
                    {use.live.size > 0 && <span className="badge green" title={[...use.live].map(label).join(", ")}>Live: {[...use.live].map(label).join(", ")}</span>}
                    {[...use.draft].filter((s) => !use.live.has(s)).length > 0 && (
                      <span className="badge amber">Draft: {[...use.draft].filter((s) => !use.live.has(s)).map(label).join(", ")}</span>
                    )}
                    {!use.used && <span className="badge plain">Tidak dipakai</span>}
                  </div>
                </div>
                <div className="acts">
                  <button className="btn sm ghost" title="Salin URL" onClick={() => { navigator.clipboard.writeText(a.public_url); toast("info", "URL disalin"); }}>
                    <Icon name="copy" />
                  </button>
                  <button className="btn sm ghost" onClick={() => startReplace(a)} disabled={!!busy} title="Ganti file (semua konten yang memakai file ini ikut diperbarui)">
                    {isBusy ? <span className="spinner" /> : <Icon name="replace" />} Ganti
                  </button>
                  <button
                    className="btn sm ghost danger"
                    style={{ marginLeft: "auto" }}
                    onClick={() => doDelete(a)}
                    disabled={!!busy || use.used}
                    title={use.used ? "Sedang dipakai di konten — ganti dulu di section terkait" : "Hapus file"}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (
        <Modal title={view.file_name} size="lg" onClose={() => setView(null)}>
          <div style={{ display: "grid", placeItems: "center", background: "#f1f1f4", borderRadius: 10, padding: 12 }}>
            {view.kind === "video" ? (
              <video src={view.public_url} controls style={{ maxWidth: "100%", maxHeight: "65vh" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={view.public_url} alt="" style={{ maxWidth: "100%", maxHeight: "65vh" }} />
            )}
          </div>
          <div className="row wrap-gap">
            <span className="badge plain">{view.mime_type}</span>
            <span className="badge plain">{formatBytes(view.size_bytes)}</span>
            {view.width ? <span className="badge plain">{view.width}×{view.height}px</span> : null}
            <span className="muted" style={{ marginLeft: "auto" }}>Diunggah {new Date(view.created_at).toLocaleString("id-ID")}</span>
          </div>
          <input className="input mono" readOnly value={view.public_url} onFocus={(e) => e.target.select()} />
        </Modal>
      )}
    </div>
  );
}
