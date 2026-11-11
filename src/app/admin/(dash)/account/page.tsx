"use client";
import { useEffect, useState } from "react";
import { useCms } from "@/components/admin/CmsContext";
import { Icon } from "@/components/admin/Icon";
import { useToast } from "@/components/admin/Toast";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type Admin = { email: string; full_name: string | null; role: string; created_at: string };

export default function AccountPage() {
  const { admin } = useCms();
  const toast = useToast();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<Admin[]>([]);

  useEffect(() => {
    api<{ team: Admin[] }>("/api/admin/team").then((r) => setTeam(r.team)).catch(() => {});
  }, []);

  const err = pw && pw.length < 10 ? "Minimal 10 karakter." : pw2 && pw !== pw2 ? "Konfirmasi password tidak sama." : "";

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (err || !pw || !cur) return;
    setBusy(true);
    const { error } = await authClient.changePassword({ currentPassword: cur, newPassword: pw, revokeOtherSessions: true });
    setBusy(false);
    if (error) return toast("error", "Gagal mengganti password", /invalid|incorrect/i.test(error.message ?? "") ? "Password saat ini salah." : error.message);
    setCur(""); setPw(""); setPw2("");
    toast("success", "Password diperbarui", "Sesi di perangkat lain telah dikeluarkan.");
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Akun</h1>
          <p>{admin.email} · {admin.role}</p>
        </div>
      </div>
      <form className="card" onSubmit={save}>
        <div className="card-head"><div><h2>Ganti password</h2><p>Gunakan minimal 10 karakter.</p></div></div>
        <div className="card-body">
          <div className="field">
            <label htmlFor="cur">Password saat ini</label>
            <input id="cur" className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} style={{ maxWidth: 360 }} />
          </div>
          <div className="field">
            <label htmlFor="pw">Password baru</label>
            <input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ maxWidth: 360 }} />
          </div>
          <div className="field">
            <label htmlFor="pw2">Ulangi password baru</label>
            <input id="pw2" className={`input${err ? " invalid" : ""}`} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={{ maxWidth: 360 }} />
            {err && <span className="err">{err}</span>}
          </div>
          <div><button className="btn primary" disabled={busy || !cur || !pw || !!err || pw !== pw2}>{busy ? <span className="spinner" /> : <Icon name="key" />} Simpan password</button></div>
        </div>
      </form>
      <div className="card">
        <div className="card-head"><div><h2>Tim admin</h2><p>Penambahan admin & reset password dilakukan oleh developer (lihat README › Akun admin).</p></div></div>
        <ul className="list">
          {team.map((a) => (
            <li key={a.email}>
              <div className="avatar">{(a.full_name || a.email)[0].toUpperCase()}</div>
              <div className="grow"><div className="title">{a.full_name || a.email}</div><div className="sub">{a.email}</div></div>
              <span className="badge plain" style={{ textTransform: "capitalize" }}>{a.role}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
