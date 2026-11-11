"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/admin/Icon";
import { Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/Toast";
import { Panel, type Meta } from "./ui";

const INTERNAL_KEY = "mil_a_internal";

export function PrivacyTab({ meta }: { meta: Meta | null }) {
  const toast = useToast();
  const [internal, setInternal] = useState<boolean | null>(null);
  const [days, setDays] = useState(meta?.retentionDays ?? 395);
  const [visitor, setVisitor] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { setInternal(localStorage.getItem(INTERNAL_KEY) === "1"); } catch { setInternal(null); }
  }, []);
  const toggleInternal = () => {
    try {
      if (internal) { localStorage.removeItem(INTERNAL_KEY); localStorage.setItem("mil_a_count_me", "1"); }
      else { localStorage.setItem(INTERNAL_KEY, "1"); localStorage.removeItem("mil_a_count_me"); }
      setInternal(!internal);
    } catch { /* storage blocked */ }
  };

  const purge = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = await api<{ deleted: number }>("/api/admin/analytics/purge", { body });
      toast("success", ok, `${r.deleted} data dihapus.`);
      setConfirmAll(false); setTyped(""); setVisitor("");
    } catch (e) {
      toast("error", "Gagal menghapus", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const consentText: Record<string, string> = {
    "opt-in": "Opt-in — tidak ada data yang direkam sebelum pengunjung menekan “Izinkan” pada banner.",
    notice: "Notice — analytics berjalan, banner memberi tahu pengunjung dan menyediakan tombol “Tolak”.",
    none: "Tanpa banner — hanya gunakan jika persetujuan sudah dikelola alat lain.",
  };

  return (
    <div className="grid a-split">
      <Panel title="Status & privasi">
        <dl className="kv">
          <dt>Tracking</dt><dd>{meta?.enabled ? <span className="badge green">Aktif</span> : <span className="badge red">Nonaktif (ANALYTICS_ENABLED)</span>}</dd>
          <dt>Mode persetujuan</dt><dd className="wrap-dd">{consentText[meta?.consentMode ?? "opt-in"]}</dd>
          <dt>Do Not Track / GPC</dt><dd>Selalu dihormati (tidak direkam)</dd>
          <dt>Zona waktu laporan</dt><dd>{meta?.timezone}</dd>
          <dt>Session timeout</dt><dd>{meta?.sessionTimeoutMin} menit tanpa aktivitas</dd>
          <dt>Retensi data mentah</dt><dd>{meta?.retentionDays} hari (dihapus otomatis tiap hari)</dd>
        </dl>
        <div className="alert info mt-16">
          <b>Yang direkam:</b> ID acak pseudonim (localStorage, bukan cookie), halaman, referrer (tanpa query string), UTM, jenis device/browser/OS,
          negara/kota perkiraan, posisi klik relatif terhadap elemen, durasi hover ≥ {meta?.hoverMinMs ?? 500} ms, kedalaman scroll, dan pemutaran video.
          <br /><b>Tidak direkam:</b> alamat IP, isi formulir/input, teks halaman, gerakan mouse mentah, rekaman layar, fingerprint.
        </div>
      </Panel>

      <div className="grid" style={{ alignContent: "start" }}>
        <Panel title="Kecualikan traffic internal">
          <p className="muted">Browser yang pernah membuka CMS otomatis dikecualikan, dan selama masih login ke CMS kunjungannya selalu diabaikan server. Untuk perangkat tim lain (yang tidak login), buka website dengan
            <span className="mono"> ?mil_internal=1</span> sekali. Kantor/agency juga bisa dikecualikan lewat <span className="mono">ANALYTICS_EXCLUDE_IPS</span>.</p>
          <div className="row mt-8">
            <span>Browser ini:</span>
            {internal === null ? <span className="muted">tidak dapat dicek</span> : internal ? <span className="badge green">dikecualikan</span> : <span className="badge amber">dihitung</span>}
            {internal !== null && <button className="btn sm" onClick={toggleInternal}>{internal ? "Hitung lagi" : "Kecualikan"}</button>}
          </div>
        </Panel>

        <Panel title="Hapus data">
          <div className="field">
            <label htmlFor="purge-days">Hapus data lebih lama dari</label>
            <div className="input-row">
              <input id="purge-days" className="input" type="number" min={30} value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ maxWidth: 120 }} />
              <span className="muted">hari</span>
              <button className="btn" disabled={busy || days < 30} onClick={() => purge({ mode: "older_than", days }, "Data lama dihapus")}>Hapus</button>
            </div>
          </div>
          <div className="field mt-16">
            <label htmlFor="purge-vid">Hapus data satu pengunjung (permintaan penghapusan data)</label>
            <div className="input-row">
              <input id="purge-vid" className="input mono" placeholder="Visitor ID (UUID)" value={visitor} onChange={(e) => setVisitor(e.target.value.trim())} />
              <button className="btn" disabled={busy || visitor.length !== 36} onClick={() => purge({ mode: "visitor", visitorId: visitor }, "Data pengunjung dihapus")}>Hapus</button>
            </div>
            <span className="help">Pengunjung dapat melihat ID-nya dengan menjalankan <span className="mono">milAnalytics.visitorId()</span> di console browser. Menekan “Tolak” pada banner juga menghapus ID dari browsernya.</span>
          </div>
          {meta?.role === "owner" && (
            <button className="btn danger mt-16" onClick={() => setConfirmAll(true)}><Icon name="trash" /> Hapus semua data analytics</button>
          )}
        </Panel>
      </div>

      {confirmAll && (
        <Modal title="Hapus semua data analytics?" onClose={() => !busy && setConfirmAll(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmAll(false)} disabled={busy}>Batal</button>
            <button className="btn danger" disabled={busy || typed !== "HAPUS"} onClick={() => purge({ mode: "all", confirm: "HAPUS" }, "Semua data analytics dihapus")}>Hapus permanen</button>
          </>}>
          <p>Semua pengunjung, sesi, klik, heatmap, dan data video akan dihapus permanen. Konten website tidak terpengaruh.</p>
          <div className="field">
            <label htmlFor="typed">Ketik <b>HAPUS</b> untuk konfirmasi</label>
            <input id="typed" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
