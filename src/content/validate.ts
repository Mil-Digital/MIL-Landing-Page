import type { Field } from "./types";

export type Errors = Record<string, string>;

const URL_RE = /^(https?:\/\/[^\s/$.?#][^\s]*|mailto:[^\s@]+@[^\s@]+|tel:\+?[\d\s-]{5,}|\/[^\s]*|#[\w-]*)$/i;

export const isValidUrl = (s: string) => URL_RE.test(s.trim());

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length) ||
  (typeof v === "object" && !Array.isArray(v) && "url" in (v as object) && !String((v as { url?: string }).url ?? "").trim());

export const visible = (f: Field, parent: Record<string, unknown>) =>
  !f.showIf || String(parent?.[f.showIf.field] ?? "") === f.showIf.equals;

/** Validate a set of fields against a value object. Error keys are dotted paths, e.g. "items.2.video". */
export function validateFields(fields: Field[], value: Record<string, unknown>, base = ""): Errors {
  const errors: Errors = {};
  for (const f of fields) {
    if (!visible(f, value)) continue;
    const path = base ? `${base}.${f.key}` : f.key;
    const v = value?.[f.key];
    if (f.required && isEmpty(v)) {
      errors[path] = f.type === "image" ? "Gambar wajib diisi." : f.type === "video" ? "Video wajib diisi." : "Wajib diisi.";
      continue;
    }
    switch (f.type) {
      case "url":
        if (typeof v === "string" && v.trim() && !isValidUrl(v))
          errors[path] = "URL tidak valid. Gunakan format https://…, mailto:…, tel:…, /halaman atau #section.";
        break;
      case "number":
        if (v !== "" && v !== null && v !== undefined) {
          const n = Number(v);
          if (!isFinite(n)) errors[path] = "Harus berupa angka.";
          else if (f.min !== undefined && n < f.min) errors[path] = `Minimal ${f.min}.`;
          else if (f.max !== undefined && n > f.max) errors[path] = `Maksimal ${f.max}.`;
        }
        break;
      case "text":
      case "textarea":
        if (f.maxLength && typeof v === "string" && v.length > f.maxLength) errors[path] = `Maksimal ${f.maxLength} karakter.`;
        if (f.key === "waNumber" && typeof v === "string" && v.trim() && !/^62\d{8,13}$/.test(v.trim()))
          errors[path] = "Format nomor: 62 diikuti nomor tanpa 0 di depan, mis. 6281234567890.";
        if (f.key === "email" && typeof v === "string" && v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
          errors[path] = "Alamat email tidak valid.";
        break;
      case "image":
      case "video": {
        const url = (v as { url?: string } | undefined)?.url ?? "";
        if (url && !isValidUrl(url)) errors[path] = "URL file tidak valid.";
        break;
      }
      case "inline": {
        const s = String(v ?? "");
        if ((s.match(/\[\[/g) ?? []).length !== (s.match(/\]\]/g) ?? []).length) errors[path] = "Tanda [[ … ]] belum berpasangan.";
        else if ((s.match(/\*/g) ?? []).length % 2) errors[path] = "Tanda * … * belum berpasangan.";
        break;
      }
      case "repeater": {
        const arr = Array.isArray(v) ? v : [];
        if (f.min !== undefined && arr.length < f.min) errors[path] = `Minimal ${f.min} item.`;
        if (f.max !== undefined && arr.length > f.max) errors[path] = `Maksimal ${f.max} item.`;
        arr.forEach((item, i) => Object.assign(errors, validateFields(f.fields, item as Record<string, unknown>, `${path}.${i}`)));
        break;
      }
    }
  }
  return errors;
}

/* ---------- immutable path helpers ---------- */
export function setIn<T>(obj: T, path: (string | number)[], val: unknown): T {
  if (!path.length) return val as T;
  const [k, ...rest] = path;
  const src = (obj ?? (typeof k === "number" ? [] : {})) as Record<string | number, unknown>;
  const copy = (Array.isArray(src) ? [...src] : { ...src }) as Record<string | number, unknown>;
  copy[k] = setIn(src[k], rest, val);
  return copy as T;
}
