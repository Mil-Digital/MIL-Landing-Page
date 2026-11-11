"use client";
import Link from "next/link";
import { SECTIONS, sectionFields } from "@/content/schema";
import { useCms } from "@/components/admin/CmsContext";
import { Icon } from "@/components/admin/Icon";
import { StatusBadge } from "@/components/admin/Shell";

const fmt = (s?: string | null) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

const countFields = (fields: ReturnType<typeof sectionFields>): number =>
  fields.reduce((n, f) => n + (f.type === "repeater" ? countFields(f.fields) : 1), 0);

export default function Overview() {
  const { admin, status, changed, changedFields, loading } = useCms();
  const totalFields = SECTIONS.reduce((n, s) => n + countFields(sectionFields(s)), 0);
  const name = admin.full_name?.split(" ")[0] || admin.email.split("@")[0];

  return (
    <div className="content wide">
      <div className="page-head">
        <div>
          <h1>Halo, {name} 👋</h1>
          <p>Kelola seluruh teks, gambar, dan video website MIL Digital dari sini.</p>
        </div>
        <div className="actions">
          <a className="btn" href="/" target="_blank" rel="noopener"><Icon name="globe" /> Lihat website</a>
        </div>
      </div>

      <div className="grid grid-3">
        <div className="card stat">
          <div className="k"><Icon name="globe" size={14} /> Status website</div>
          <div className="v" style={{ marginTop: 10 }}>{loading ? "…" : <StatusBadge />}</div>
          <div className="s">
            {changedFields ? `${changedFields} isian di ${changed.size} section menunggu dipublikasikan` : "Semua perubahan sudah live"}
          </div>
        </div>
        <div className="card stat">
          <div className="k"><Icon name="rocket" size={14} /> Terakhir dipublikasikan</div>
          <div className="v" style={{ fontSize: 17 }}>{fmt(status?.last_published_at)}</div>
          <div className="s">
            {status?.published_version ? `Versi ${status.published_version}` : ""}
            {status?.last_published_by_email ? ` · oleh ${status.last_published_by_email}` : ""}
          </div>
        </div>
        <div className="card stat">
          <div className="k"><Icon name="edit" size={14} /> Terakhir diedit</div>
          <div className="v" style={{ fontSize: 17 }}>{fmt(status?.last_draft_saved_at)}</div>
          <div className="s">{status?.last_draft_saved_by_email ? `oleh ${status.last_draft_saved_by_email}` : "Belum ada perubahan"}</div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        <Link href="/admin/content/hero" className="card shortcut">
          <span className="ic"><Icon name="edit" /></span>
          <span><b>Content Editor</b><span>Edit teks & konten per section</span></span>
        </Link>
        <Link href="/admin/media" className="card shortcut">
          <span className="ic"><Icon name="media" /></span>
          <span><b>Media Library</b><span>Upload & ganti gambar dan video</span></span>
        </Link>
        <Link href="/admin/content/settings" className="card shortcut">
          <span className="ic"><Icon name="settings" /></span>
          <span><b>Settings</b><span>SEO, gambar share & WhatsApp</span></span>
        </Link>
        <Link href="/admin/analytics" className="card shortcut">
          <span className="ic"><Icon name="stats" /></span>
          <span><b>Analytics</b><span>Traffic, klik, heatmap & performa video</span></span>
        </Link>
      </div>

      <div className="card mt-16">
        <div className="card-head">
          <div>
            <h2>Section halaman</h2>
            <p>{SECTIONS.length} section · {totalFields} isian yang dapat dikelola</p>
          </div>
          <a className="btn sm" href="/admin/preview" target="_blank" rel="noopener"><Icon name="eye" /> Preview draft</a>
        </div>
        <ul className="list">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <span className="shortcut" style={{ padding: 0 }}><span className="ic" style={{ width: 32, height: 32 }}><Icon name={s.icon} /></span></span>
              <div className="grow">
                <div className="title">{s.label}</div>
                <div className="sub">{s.description}</div>
              </div>
              {changed.has(s.id) ? <span className="badge amber">Draft</span> : <span className="badge green">Live</span>}
              <Link href={`/admin/content/${s.id}`} className="btn sm">Edit</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
