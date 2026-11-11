"use client";
import { useCallback, useEffect, useState } from "react";
import { useCms } from "@/components/admin/CmsContext";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { api } from "@/lib/api";

type Version = { version_number: number; note: string | null; published_at: string; published_by_email: string | null };

export default function HistoryPage() {
  const toast = useToast();
  const { status, changedFields, refresh } = useCms();
  const [items, setItems] = useState<Version[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ versions: Version[] }>("/api/admin/versions")).versions);
    } catch (e) {
      toast("error", "Gagal memuat riwayat", (e as Error).message);
      setItems([]);
    }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const restore = async (v: number) => {
    if (!window.confirm(`Muat isi versi ${v} ke draft?\n\nDraft yang sekarang akan ditimpa. Website live tidak berubah sampai Anda klik Publish.`)) return;
    setBusy(`r${v}`);
    try {
      await api("/api/admin/versions/restore", { body: { version: v } });
    } catch (e) {
      setBusy(null);
      return toast("error", "Gagal memulihkan versi", (e as Error).message);
    }
    setBusy(null);
    await refresh();
    toast("success", `Versi ${v} dimuat ke draft`, "Cek Preview, lalu klik Publish untuk menerapkannya di website.");
  };

  const discard = async () => {
    if (!window.confirm("Buang semua perubahan draft yang belum dipublikasikan? Konten akan kembali sama seperti website live.")) return;
    setBusy("discard");
    let n = 0;
    try {
      n = (await api<{ discarded: number }>("/api/admin/discard", { body: {} })).discarded;
    } catch (e) {
      setBusy(null);
      return toast("error", "Gagal membuang draft", (e as Error).message);
    }
    setBusy(null);
    await refresh();
    toast("success", "Draft dibuang", `${n} isian dikembalikan ke versi live.`);
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Riwayat versi</h1>
          <p>Setiap kali Publish, salinan lengkap website disimpan. Anda dapat melihat versi lama dan mengembalikannya kapan saja.</p>
        </div>
        <div className="actions">
          <button className="btn danger" onClick={discard} disabled={!changedFields || !!busy}>
            {busy === "discard" ? <span className="spinner" /> : <Icon name="trash" />} Buang draft belum publish
          </button>
        </div>
      </div>

      <div className="card">
        {items === null ? (
          <div className="card-pad"><div className="progress"><i /></div></div>
        ) : items.length === 0 ? (
          <div className="empty">Belum ada versi yang dipublikasikan.</div>
        ) : (
          <ul className="list">
            {items.map((v) => {
              const live = v.version_number === status?.published_version;
              return (
                <li key={v.version_number}>
                  <span className="badge plain mono" style={{ minWidth: 44, justifyContent: "center" }}>v{v.version_number}</span>
                  <div className="grow">
                    <div className="title">{v.note || <span className="muted">Tanpa catatan</span>}</div>
                    <div className="sub">
                      {new Date(v.published_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      {v.published_by_email ? ` · ${v.published_by_email}` : ""}
                    </div>
                  </div>
                  {live && <span className="badge green">Live sekarang</span>}
                  <a className="btn sm" href={`/admin/preview?version=${v.version_number}`} target="_blank" rel="noopener">
                    <Icon name="eye" /> Lihat
                  </a>
                  <button className="btn sm" onClick={() => restore(v.version_number)} disabled={!!busy}>
                    {busy === `r${v.version_number}` ? <span className="spinner" /> : <Icon name="history" />} Pulihkan
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
