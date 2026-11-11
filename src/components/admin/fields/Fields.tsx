"use client";
import { useRef, useState, type ReactNode } from "react";
import type { Field, ImageValue, InlineField, RepeaterField, VideoValue, IconField } from "@/content/types";
import { visible, type Errors } from "@/content/validate";
import { inline } from "@/site/format";
import { CARD_ICONS, TAG_ICONS } from "@/site/generated/icons";
import { uploadAsset, validateFile } from "@/lib/media";
import { Icon } from "../Icon";
import { MediaPicker, Thumb } from "../MediaPicker";
import { useToast } from "../Toast";

type Props = {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  path: string;
  errors: Errors;
  showRequired: boolean;
};

const errFor = (errors: Errors, path: string, showRequired: boolean) => {
  const e = errors[path];
  if (!e) return undefined;
  if (!showRequired && /wajib diisi/i.test(e)) return undefined;
  return e;
};

function Wrap({ field, id, err, children, extra }: { field: Field; id?: string; err?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="field" data-path={id}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span className="req" aria-label="wajib">*</span>}
        {extra}
      </label>
      {children}
      {err ? <span className="err" role="alert">{err}</span> : field.help ? <span className="help">{field.help}</span> : null}
    </div>
  );
}

const fid = (p: string) => "f-" + p.replace(/[^\w-]/g, "_");

export function FieldInput(props: Props) {
  const { field, value, onChange, path, errors, showRequired } = props;
  const err = errFor(errors, path, showRequired);
  const id = fid(path);

  switch (field.type) {
    case "text":
    case "url": {
      const s = String(value ?? "");
      const max = field.type === "text" ? field.maxLength : undefined;
      return (
        <Wrap field={field} id={id} err={err} extra={max ? <span className={`count${s.length > max ? " over" : ""}`}>{s.length}/{max}</span> : undefined}>
          <div className="input-row">
            <input
              id={id}
              className={`input${err ? " invalid" : ""}`}
              type={field.type === "url" ? "url" : "text"}
              inputMode={field.type === "url" ? "url" : undefined}
              value={s}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
              aria-invalid={!!err}
            />
            {field.type === "url" && s.trim() && !err && /^https?:/i.test(s) && (
              <a className="btn icon" href={s} target="_blank" rel="noopener noreferrer" title="Tes link">
                <Icon name="external" />
              </a>
            )}
          </div>
        </Wrap>
      );
    }
    case "textarea": {
      const s = String(value ?? "");
      return (
        <Wrap field={field} id={id} err={err} extra={field.maxLength ? <span className={`count${s.length > field.maxLength ? " over" : ""}`}>{s.length}/{field.maxLength}</span> : undefined}>
          <textarea id={id} className={`textarea${err ? " invalid" : ""}`} rows={field.rows ?? 3} value={s} onChange={(e) => onChange(e.target.value)} aria-invalid={!!err} />
        </Wrap>
      );
    }
    case "number":
      return (
        <Wrap field={field} id={id} err={err}>
          <input
            id={id}
            className={`input${err ? " invalid" : ""}`}
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            style={{ maxWidth: 180 }}
          />
        </Wrap>
      );
    case "select":
      return (
        <Wrap field={field} id={id} err={err}>
          <select id={id} className="select" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 320 }}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Wrap>
      );
    case "inline":
      return <InlineInput {...props} field={field} err={err} id={id} />;
    case "image":
    case "video":
      return <MediaInput {...props} err={err} id={id} />;
    case "icon":
      return <IconInput field={field} value={String(value ?? "")} onChange={onChange} id={id} />;
    case "list":
      return <ListInput {...props} id={id} err={err} />;
    case "repeater":
      return <RepeaterInput {...props} field={field} err={err} />;
  }
}

/* ---------------- inline formatted text ---------------- */
function InlineInput({ field, value, onChange, err, id }: Props & { field: InlineField; err?: string; id: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const s = String(value ?? "");
  const wrap = (a: string, b: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: st, selectionEnd: en } = el;
    if (st === en) return;
    const next = s.slice(0, st) + a + s.slice(st, en) + b + s.slice(en);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(st + a.length, en + a.length);
    });
  };
  const hasMarkup = /\*|\[\[|\n/.test(s);
  const hl = { accent: "Warna oranye", em: "Miring berwarna", b: "Tebal", i: "Warna oranye" } as const;
  return (
    <Wrap field={field} id={id} err={err}>
      <div className="toolbar">
        {field.highlight && (
          <button type="button" className="tb-btn" onClick={() => wrap("*", "*")} title="Blok teks lalu klik untuk menyorot (*teks*)">
            ✦ {hl[field.highlight]}
          </button>
        )}
        <button type="button" className="tb-btn" onClick={() => wrap("[[", "]]")} title="Blok kata-kata yang tidak boleh terpotong ke baris berikutnya ([[teks]])">
          ⟷ Jangan dipisah baris
        </button>
      </div>
      <textarea
        ref={ref}
        id={id}
        className={`textarea${err ? " invalid" : ""}`}
        rows={field.multiline ? 3 : 1}
        value={s}
        onChange={(e) => onChange(field.allowBreaks ? e.target.value : e.target.value.replace(/\r?\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !field.allowBreaks) e.preventDefault();
        }}
        style={field.multiline ? undefined : { resize: "none", minHeight: 36, height: 38, overflow: "hidden" }}
        aria-invalid={!!err}
      />
      {hasMarkup && (
        <div className="inline-preview" aria-label="Pratinjau format">
          <span className="muted" style={{ fontSize: 11.5, marginRight: 6 }}>Pratinjau:</span>
          <span dangerouslySetInnerHTML={{ __html: inline(s, field.highlight, field.allowBreaks) }} />
        </div>
      )}
    </Wrap>
  );
}

/* ---------------- image / video ---------------- */
function MediaInput({ field, value, onChange, err, id, path }: Props & { err?: string; id: string }) {
  const kind = field.type === "video" ? "video" : "image";
  const v = (value ?? { url: "" }) as ImageValue & VideoValue;
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const dark = /logo/i.test(path);
  const tall = kind === "video" || /poster/i.test(path);

  const set = (patch: Partial<ImageValue>) => onChange({ ...v, ...patch });
  const upload = async (f?: File) => {
    if (!f) return;
    const problem = validateFile(f, kind);
    if (problem) return toast("error", "File tidak valid", problem);
    setBusy(true);
    try {
      const a = await uploadAsset(f, kind);
      set({ url: a.public_url, ...(kind === "image" ? { width: a.width ?? undefined, height: a.height ?? undefined } : {}) });
      toast("success", "File diunggah", "Jangan lupa klik Simpan draft.");
    } catch (e) {
      toast("error", "Upload gagal", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fname = v.url ? decodeURIComponent(v.url.split("/").pop() ?? "") : "";
  const imgField = field.type === "image" ? field : null;

  return (
    <Wrap field={field} id={id} err={err}>
      <div
        className={`media-field${drag ? " drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files?.[0]); }}
      >
        {kind === "image" ? <Thumb url={v.url} kind="image" dark={dark} tall={tall} /> : <Thumb url={v.url} kind="video" tall />}
        <div className="media-meta">
          <div className="fname" title={v.url}>
            {fname || <span className="muted">Belum ada file — tarik & lepas file ke sini</span>}
            {kind === "image" && v.width ? <span className="muted"> · {v.width}×{v.height}px</span> : null}
          </div>
          <div className="btns">
            <input ref={input} id={id} type="file" hidden accept={kind === "image" ? "image/jpeg,image/png,image/webp,image/avif,image/gif" : "video/mp4,video/webm,video/quicktime"} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" className="btn sm" onClick={() => input.current?.click()} disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="upload" />} {v.url ? "Ganti" : "Upload"}
            </button>
            <button type="button" className="btn sm" onClick={() => setPicker(true)} disabled={busy}>
              <Icon name="media" /> Media Library
            </button>
            {v.url && kind === "video" && (
              <a className="btn sm ghost" href={v.url} target="_blank" rel="noopener noreferrer"><Icon name="eye" /> Putar</a>
            )}
            {v.url && !field.required && (
              <button type="button" className="btn sm ghost danger" onClick={() => onChange({ url: "" })}>
                <Icon name="trash" /> Hapus
              </button>
            )}
          </div>
          {busy && <div className="progress"><i /></div>}
          {imgField?.withAlt && (
            <input className="input" value={v.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} placeholder="Teks alternatif (alt) — deskripsikan gambar untuk SEO & aksesibilitas" aria-label={`Alt text ${field.label}`} />
          )}
        </div>
      </div>
      {picker && (
        <MediaPicker
          kind={kind}
          onClose={() => setPicker(false)}
          onPick={(a) => {
            set({ url: a.public_url, ...(kind === "image" ? { width: a.width ?? undefined, height: a.height ?? undefined } : {}) });
            setPicker(false);
          }}
        />
      )}
    </Wrap>
  );
}

/* ---------------- icon picker ---------------- */
function IconInput({ field, value, onChange, id }: { field: IconField; value: string; onChange: (v: unknown) => void; id: string }) {
  const set = field.set === "tag" ? TAG_ICONS : CARD_ICONS;
  const [open, setOpen] = useState(false);
  const cur = set[value];
  return (
    <div className="field">
      <span className="label" id={id}>{field.label}</span>
      <div className="icon-current">
        <span className={`sw set-${field.set}`} dangerouslySetInnerHTML={{ __html: cur?.svg ?? "" }} />
        <span className="muted">{cur?.label ?? "—"}</span>
        <button type="button" className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Tutup" : "Ganti ikon"}
        </button>
      </div>
      {open && (
        <div className="icon-grid" role="listbox" aria-labelledby={id}>
          {Object.entries(set).map(([k, ic]) => (
            <button
              type="button"
              key={k}
              role="option"
              aria-selected={k === value}
              title={ic.label}
              className={`icon-opt set-${field.set}${k === value ? " on" : ""}`}
              onClick={() => { onChange(k); setOpen(false); }}
              dangerouslySetInnerHTML={{ __html: ic.svg }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- simple string list ---------------- */
function ListInput({ field, value, onChange, id, err }: Props & { id: string; err?: string }) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  if (field.type !== "list") return null;
  const move = (i: number, d: number) => {
    const n = [...arr];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  return (
    <Wrap field={field} id={id} err={err}>
      <div className="repeater">
        {arr.map((s, i) => (
          <div className="list-row" key={i}>
            <input className="input" value={s} placeholder={field.placeholder} onChange={(e) => onChange(arr.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`${field.itemLabel} ${i + 1}`} id={i === 0 ? id : undefined} />
            <button type="button" className="btn icon ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Naikkan"><Icon name="up" /></button>
            <button type="button" className="btn icon ghost" disabled={i === arr.length - 1} onClick={() => move(i, 1)} aria-label="Turunkan"><Icon name="down" /></button>
            <button type="button" className="btn icon ghost danger" onClick={() => onChange(arr.filter((_, k) => k !== i))} aria-label="Hapus"><Icon name="trash" /></button>
          </div>
        ))}
        <button type="button" className="btn sm rep-add" onClick={() => onChange([...arr, ""])}>
          <Icon name="plus" /> Tambah {field.itemLabel.toLowerCase()}
        </button>
      </div>
    </Wrap>
  );
}

/* ---------------- repeater ---------------- */
const getPath = (o: unknown, p: string): unknown => p.split(".").reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);

function RepeaterInput({ field, value, onChange, path, errors, showRequired, err }: Props & { field: RepeaterField; err?: string }) {
  const arr = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const [open, setOpen] = useState<number | null>(arr.length <= 1 ? 0 : null);
  const canAdd = !field.fixed && (field.max === undefined || arr.length < field.max);
  const canRemove = !field.fixed && (field.min === undefined || arr.length > field.min);

  const move = (i: number, d: number) => {
    const n = [...arr];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
    if (open === i) setOpen(i + d);
    else if (open === i + d) setOpen(i);
  };
  const remove = (i: number) => {
    const t = String(getPath(arr[i], field.titleKey ?? "") ?? "").trim();
    if (!window.confirm(`Hapus ${field.itemLabel.toLowerCase()}${t ? ` “${t}”` : ""}?`)) return;
    onChange(arr.filter((_, k) => k !== i));
    setOpen(null);
  };
  const add = () => {
    onChange([...arr, structuredClone(field.newItem)]);
    setOpen(arr.length);
  };
  const dup = (i: number) => {
    const n = [...arr];
    n.splice(i + 1, 0, structuredClone(arr[i]));
    onChange(n);
    setOpen(i + 1);
  };
  const itemHasErr = (i: number) => Object.keys(errors).some((k) => k.startsWith(`${path}.${i}.`) && (showRequired || !/wajib/i.test(errors[k])));

  return (
    <div className="field">
      <span className="label">
        {field.label}
        <span className="count">{arr.length}{field.max ? ` / ${field.max}` : ""} item</span>
      </span>
      {field.help && <span className="help">{field.help}</span>}
      <div className="repeater">
        {arr.map((item, i) => {
          const title = String(getPath(item, field.titleKey ?? "") ?? "").replace(/\*|\[\[|\]\]/g, "").trim();
          const isOpen = open === i;
          return (
            <div key={i} className={`rep-item${isOpen ? " open" : ""}${itemHasErr(i) ? " rep-err" : ""}`}>
              <div className="rep-head" onClick={() => setOpen(isOpen ? null : i)} role="button" aria-expanded={isOpen} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(isOpen ? null : i))}>
                <span className="idx">{i + 1}</span>
                <span className={`ttl${title ? "" : " empty"}`}>{title || `${field.itemLabel} tanpa judul`}</span>
                {itemHasErr(i) && <span className="badge red plain">Perlu dicek</span>}
                <span className="row" onClick={(e) => e.stopPropagation()}>
                  {!field.fixed && (
                    <>
                      <button type="button" className="btn icon ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Pindah ke atas" title="Pindah ke atas"><Icon name="up" /></button>
                      <button type="button" className="btn icon ghost" disabled={i === arr.length - 1} onClick={() => move(i, 1)} aria-label="Pindah ke bawah" title="Pindah ke bawah"><Icon name="down" /></button>
                      {canAdd && <button type="button" className="btn icon ghost" onClick={() => dup(i)} aria-label="Duplikat" title="Duplikat"><Icon name="duplicate" /></button>}
                      {canRemove && <button type="button" className="btn icon ghost danger" onClick={() => remove(i)} aria-label="Hapus" title="Hapus"><Icon name="trash" /></button>}
                    </>
                  )}
                </span>
                <Icon name="chevron" className="chev" />
              </div>
              {isOpen && (
                <div className="rep-body">
                  {field.fields.filter((f) => visible(f, item)).map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={item?.[f.key]}
                      path={`${path}.${i}.${f.key}`}
                      errors={errors}
                      showRequired={showRequired}
                      onChange={(nv) => onChange(arr.map((x, k) => (k === i ? { ...x, [f.key]: nv } : x)))}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {arr.length === 0 && <div className="help">Belum ada item.</div>}
        {canAdd && (
          <button type="button" className="btn sm rep-add" onClick={add}>
            <Icon name="plus" /> Tambah {field.itemLabel.toLowerCase()}
          </button>
        )}
        {err && <span className="err">{err}</span>}
      </div>
    </div>
  );
}
