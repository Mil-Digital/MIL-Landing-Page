"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { SECTIONS } from "@/content/schema";
import { authClient } from "@/lib/auth-client";
import { CmsProvider, useCms, type AdminInfo } from "./CmsContext";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

export function Shell({ admin, children }: { admin: AdminInfo; children: ReactNode }) {
  return (
    <CmsProvider admin={admin}>
      <ShellInner>{children}</ShellInner>
    </CmsProvider>
  );
}

const contentSections = SECTIONS.filter((s) => s.id !== "settings");

function ShellInner({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { admin, changed, confirmLeave } = useCms();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  // Browsers used for the CMS are internal traffic: never counted by the website analytics.
  useEffect(() => {
    try {
      if (localStorage.getItem("mil_a_count_me") !== "1") localStorage.setItem("mil_a_internal", "1");
    } catch { /* storage unavailable */ }
  }, []);

  const guard = (e: MouseEvent) => {
    if (!confirmLeave()) e.preventDefault();
  };
  const item = (href: string, icon: string, label: string, dot?: boolean, exact?: boolean) => {
    const active = exact ? path === href : path === href || path.startsWith(href + "/");
    return (
      <Link key={href} href={href} onClick={guard} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
        <Icon name={icon} />
        <span>{label}</span>
        {dot && <span className="dot" title="Ada perubahan yang belum dipublikasikan" />}
      </Link>
    );
  };

  const signOut = async () => {
    if (!confirmLeave()) return;
    await authClient.signOut();
    window.location.href = "/admin/login";
  };

  const current =
    path === "/admin"
      ? "Dashboard"
      : path.startsWith("/admin/content/")
        ? SECTIONS.find((s) => path.endsWith("/" + s.id))?.label ?? "Konten"
        : path.startsWith("/admin/media") ? "Media Library"
        : path.startsWith("/admin/analytics") ? "Analytics"
        : path.startsWith("/admin/history") ? "Riwayat versi"
        : path.startsWith("/admin/devices") ? "Preview responsif"
        : path.startsWith("/admin/account") ? "Akun" : "";

  return (
    <div className={`shell${open ? " nav-open" : ""}`} onClick={(e) => open && e.target === e.currentTarget && setOpen(false)}>
      <aside className="sidebar" aria-label="Navigasi CMS">
        <div className="brand">
          <div className="brand-mark">MIL</div>
          <div>
            <b>MIL Digital</b>
            <small>Content Studio</small>
          </div>
        </div>
        {item("/admin", "home", "Dashboard", false, true)}
        {item("/admin/analytics", "stats", "Analytics")}
        <div className="nav-label">Konten halaman</div>
        {contentSections.map((s) => item(`/admin/content/${s.id}`, s.icon, s.label, changed.has(s.id)))}
        <div className="nav-label">Kelola</div>
        {item("/admin/media", "media", "Media Library")}
        {item("/admin/content/settings", "settings", "SEO & Settings", changed.has("settings"))}
        {item("/admin/history", "history", "Riwayat versi")}
        {item("/admin/devices", "monitor", "Preview responsif")}
        <div className="sidebar-foot">
          <Link href="/admin/account" onClick={guard} className="user-chip" title="Pengaturan akun">
            <div className="avatar">{(admin.full_name || admin.email).slice(0, 1).toUpperCase()}</div>
            <div className="who">
              <b>{admin.full_name || admin.email}</b>
              <small>{admin.role}</small>
            </div>
          </Link>
          <button className="nav-item" onClick={signOut}>
            <Icon name="logout" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Icon name="menu" />
          </button>
          <div className="crumb">
            <span className="hide-sm">Content Studio</span>
            <span className="hide-sm muted">/</span>
            <b>{current}</b>
          </div>
          <div className="spacer" />
          <PublishControls />
        </header>
        {children}
      </div>
    </div>
  );
}

export function StatusBadge() {
  const { changedFields, loading } = useCms();
  if (loading) return <span className="badge plain">Memuat…</span>;
  return changedFields ? (
    <span className="badge amber" title="Perubahan tersimpan sebagai draft dan belum terlihat oleh pengunjung">
      Draft · {changedFields} perubahan
    </span>
  ) : (
    <span className="badge green">Published</span>
  );
}

function PublishControls() {
  const { changed, changedFields, publish, dirty } = useCms();
  const toast = useToast();
  const [show, setShow] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const doPublish = async () => {
    setBusy(true);
    try {
      const v = await publish(note);
      toast("success", "Website dipublikasikan", `Versi ${v} sekarang tampil untuk pengunjung.`);
      setShow(false);
      setNote("");
    } catch (e) {
      toast("error", "Gagal mempublikasikan", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className="hide-sm">
        <StatusBadge />
      </span>
      <a className="btn sm" href="/admin/preview" target="_blank" rel="noopener" title="Lihat draft dalam tab baru">
        <Icon name="eye" /> <span className="hide-sm">Preview</span>
      </a>
      <a className="btn sm ghost hide-sm" href="/" target="_blank" rel="noopener" title="Buka website live">
        <Icon name="external" />
      </a>
      <button className="btn sm primary" onClick={() => setShow(true)} disabled={!changedFields && !dirty}>
        <Icon name="rocket" /> Publish
      </button>
      {show && (
        <Modal
          title="Publish ke website"
          onClose={() => !busy && setShow(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShow(false)} disabled={busy}>
                Batal
              </button>
              <button className="btn primary" onClick={doPublish} disabled={busy || !changedFields}>
                {busy ? <span className="spinner" /> : <Icon name="rocket" />} Publish sekarang
              </button>
            </>
          }
        >
          {dirty && (
            <div className="alert warn">
              Ada perubahan di form yang <b>belum disimpan</b>. Klik <b>Simpan draft</b> dulu — hanya draft tersimpan yang ikut dipublikasikan.
            </div>
          )}
          {changedFields ? (
            <>
              <p>
                Perubahan draft pada bagian berikut akan langsung tampil di website untuk semua pengunjung:
              </p>
              <div className="row wrap-gap">
                {SECTIONS.filter((s) => changed.has(s.id)).map((s) => (
                  <span key={s.id} className="badge blue plain">
                    {s.label}
                  </span>
                ))}
              </div>
              <div className="field">
                <label htmlFor="pub-note">Catatan versi (opsional)</label>
                <input id="pub-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. Update testimoni Oktober" maxLength={300} />
                <span className="help">Membantu saat ingin mengembalikan versi lama di menu Riwayat versi.</span>
              </div>
              <a className="btn" href="/admin/preview" target="_blank" rel="noopener">
                <Icon name="eye" /> Cek preview dulu
              </a>
            </>
          ) : (
            <p className="muted">Tidak ada perubahan draft yang tersimpan. Semua konten sudah live.</p>
          )}
        </Modal>
      )}
    </>
  );
}
