"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_CONTENT, getSection, sectionFields } from "@/content/schema";
import { validateFields } from "@/content/validate";
import { api } from "@/lib/api";
import { useCms } from "./CmsContext";
import { FieldInput } from "./fields/Fields";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

type Values = Record<string, unknown>;
const json = (v: unknown) => JSON.stringify(v ?? null);

export function SectionEditor({ sectionId }: { sectionId: string }) {
  const section = getSection(sectionId)!;
  const fields = useMemo(() => sectionFields(section), [section]);
  const { rows, loading, refresh, setDirty, changed } = useCms();
  const toast = useToast();

  // Saved draft for this section (missing fields fall back to the original content).
  const saved = useMemo<Values>(() => {
    const out: Values = {};
    for (const f of fields) {
      const r = rows.find((x) => x.section_id === sectionId && x.field_key === f.key);
      out[f.key] = r && r.draft_value !== null && r.draft_value !== undefined ? r.draft_value : DEFAULT_CONTENT[sectionId]?.[f.key];
    }
    return out;
  }, [rows, fields, sectionId]);

  const [values, setValues] = useState<Values>(saved);
  const [base, setBase] = useState<Values>(saved);
  const [saving, setSaving] = useState(false);
  const [showRequired, setShowRequired] = useState(false);

  // When server data (re)loads and the form is untouched, sync it.
  useEffect(() => {
    if (json(values) === json(base)) {
      setValues(saved);
      setBase(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const dirtyKeys = fields.filter((f) => json(values[f.key]) !== json(base[f.key])).map((f) => f.key);
  const isDirty = dirtyKeys.length > 0;
  useEffect(() => setDirty(isDirty), [isDirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);

  const errors = useMemo(() => validateFields(fields, values), [fields, values]);
  const errorCount = Object.keys(errors).length;

  const save = useCallback(async () => {
    setShowRequired(true);
    if (Object.keys(errors).length) {
      toast("error", "Perubahan belum disimpan", `Ada ${Object.keys(errors).length} isian yang perlu diperbaiki (ditandai merah).`);
      requestAnimationFrame(() => document.querySelector(".err, .rep-err")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setSaving(true);
    const items = dirtyKeys.map((k) => ({ section_id: sectionId, field_key: k, draft_value: values[k] ?? null }));
    try {
      await api("/api/admin/content", { method: "PUT", body: { items } });
    } catch (e) {
      setSaving(false);
      toast("error", "Gagal menyimpan draft", (e as Error).message);
      return;
    }
    setSaving(false);
    setBase(values);
    setShowRequired(false);
    toast("success", "Draft tersimpan", "Cek lewat Preview, lalu klik Publish agar tampil di website.");
    refresh();
  }, [errors, dirtyKeys, sectionId, fields, values, toast, refresh]);

  const cancel = () => {
    if (!window.confirm("Batalkan semua perubahan yang belum disimpan di halaman ini?")) return;
    setValues(base);
    setShowRequired(false);
    toast("info", "Perubahan dibatalkan");
  };

  const resetToOriginal = () => {
    if (!window.confirm(`Kembalikan seluruh isi “${section.label}” ke konten original landing page? Perubahan baru tersimpan setelah klik Simpan draft.`)) return;
    setValues(structuredClone(DEFAULT_CONTENT[sectionId] ?? {}));
  };

  // Cmd/Ctrl+S to save
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (isDirty && !saving) save();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [isDirty, saving, save]);

  if (loading) {
    return (
      <div className="content">
        <div className="progress"><i /></div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <h1>{section.label}</h1>
            {changed.has(sectionId) && <span className="badge amber">Belum dipublikasikan</span>}
          </div>
          <p>{section.description}</p>
        </div>
        <div className="actions">
          <a className="btn sm" href={`/admin/preview#${sectionId === "workflow" ? "framework" : ""}`} target="_blank" rel="noopener">
            <Icon name="eye" /> Preview draft
          </a>
          <button className="btn sm ghost" onClick={resetToOriginal} title="Isi ulang dengan konten original">
            <Icon name="refresh" /> Konten original
          </button>
        </div>
      </div>

      <nav className="section-nav" aria-label="Lompat ke grup">
        {section.groups.map((g, i) => (
          <a key={g.title} href={`#g-${i}`}>{g.title}</a>
        ))}
      </nav>

      {section.groups.map((g, i) => (
        <section key={g.title} className="card" id={`g-${i}`} style={{ scrollMarginTop: 72 }}>
          <div className="card-head">
            <div>
              <h2>{g.title}</h2>
              {g.description && <p>{g.description}</p>}
            </div>
          </div>
          <div className="card-body">
            {g.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={values[f.key]}
                path={f.key}
                errors={errors}
                showRequired={showRequired}
                onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
              />
            ))}
          </div>
        </section>
      ))}

      <p className="muted mt-16" style={{ fontSize: 12.5 }}>
        Tips: tekan <span className="mono">⌘/Ctrl + S</span> untuk menyimpan draft. Perubahan baru tampil di website setelah di-
        <b>Publish</b>. Kelola semua file di <Link href="/admin/media" style={{ textDecoration: "underline" }}>Media Library</Link>.
      </p>

      <div className={`savebar${isDirty ? "" : " hidden"}`} aria-hidden={!isDirty}>
        <div className="savebar-inner">
          <span className="msg">
            <Icon name="edit" size={15} />
            {dirtyKeys.length} isian diubah
            {showRequired && errorCount > 0 && <span className="badge red plain" style={{ marginLeft: 6 }}>{errorCount} error</span>}
          </span>
          <button className="btn sm" onClick={cancel} disabled={saving}>Batalkan perubahan</button>
          <button className="btn sm save" onClick={save} disabled={saving}>
            {saving ? <span className="spinner" /> : <Icon name="check" />} Simpan draft
          </button>
        </div>
      </div>
    </div>
  );
}
