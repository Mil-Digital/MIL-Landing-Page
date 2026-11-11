import { DEFAULT_CONTENT, SECTIONS, sectionFields } from "./schema";
import type { SiteContent } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Is the stored value structurally compatible with the default? (guards against corrupted rows) */
function compatible(def: unknown, val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (Array.isArray(def)) return Array.isArray(val);
  if (isObj(def)) return isObj(val);
  if (typeof def === "number") return typeof val === "number" || (typeof val === "string" && val !== "" && !isNaN(+val));
  return typeof val === "string" || typeof val === "number";
}

/**
 * Merge stored values over the defaults, field by field.
 * Any section/field missing from the database (or malformed) falls back to the original copy,
 * so the public page can never render blank.
 */
export function resolveContent(stored: SiteContent | null | undefined): SiteContent {
  const out: SiteContent = {};
  for (const s of SECTIONS) {
    const defs = DEFAULT_CONTENT[s.id] ?? {};
    const vals = (stored && stored[s.id]) || {};
    const sec: Record<string, unknown> = {};
    for (const f of sectionFields(s)) {
      const d = defs[f.key];
      const v = vals[f.key];
      sec[f.key] = compatible(d ?? "", v) ? v : d;
    }
    out[s.id] = sec;
  }
  return out;
}

export const rowsToContent = (
  rows: { section_id: string; field_key: string; value: unknown }[] | null | undefined,
): SiteContent => {
  const c: SiteContent = {};
  for (const r of rows ?? []) {
    (c[r.section_id] ??= {})[r.field_key] = r.value;
  }
  return c;
};
