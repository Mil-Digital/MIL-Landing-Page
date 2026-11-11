"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type ContentRow = { section_id: string; field_key: string; field_type: string; draft_value: unknown; published_value: unknown; updated_at: string };
export type SiteStatus = {
  last_draft_saved_at: string | null;
  last_draft_saved_by_email: string | null;
  last_published_at: string | null;
  last_published_by_email: string | null;
  published_version: number | null;
};
export type AdminInfo = { email: string; full_name: string | null; role: string };

type Ctx = {
  admin: AdminInfo;
  rows: ContentRow[];
  status: SiteStatus | null;
  loading: boolean;
  /** section ids with unpublished (saved draft) changes */
  changed: Set<string>;
  changedFields: number;
  refresh: () => Promise<void>;
  publish: (note?: string) => Promise<number>;
  /** unsaved form edits in the current editor (used to warn before navigation) */
  dirty: boolean;
  setDirty: (d: boolean) => void;
  confirmLeave: () => boolean;
};

const C = createContext<Ctx | null>(null);
export const useCms = () => {
  const c = useContext(C);
  if (!c) throw new Error("useCms outside provider");
  return c;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function CmsProvider({ admin, children }: { admin: AdminInfo; children: ReactNode }) {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ rows: ContentRow[]; status: SiteStatus | null }>("/api/admin/content");
      setRows(r.rows);
      setStatus(r.status);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { changed, changedFields } = useMemo(() => {
    const set = new Set<string>();
    let n = 0;
    for (const r of rows) {
      if (!same(r.draft_value, r.published_value)) {
        set.add(r.section_id);
        n++;
      }
    }
    return { changed: set, changedFields: n };
  }, [rows]);

  const publish = useCallback(
    async (note?: string) => {
      const j = await api<{ version: number }>("/api/admin/publish", { body: { note } });
      await refresh();
      return j.version;
    },
    [refresh],
  );

  const setDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirtyState(d);
  }, []);

  const confirmLeave = useCallback(
    () => !dirtyRef.current || window.confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman ini? Perubahan akan hilang."),
    [],
  );

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  return (
    <C.Provider value={{ admin, rows, status, loading, changed, changedFields, refresh, publish, dirty, setDirty, confirmLeave }}>
      {children}
    </C.Provider>
  );
}
