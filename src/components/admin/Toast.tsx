"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

type Kind = "success" | "error" | "info";
type T = { id: number; kind: Kind; title: string; text?: string };
const Ctx = createContext<(kind: Kind, title: string, text?: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: Kind, title: string, text?: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, title, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 9000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <Icon name={t.kind === "success" ? "check" : t.kind === "error" ? "alert" : "info"} className="ti" />
            <div>
              <b>{t.title}</b>
              {t.text && <span>{t.text}</span>}
            </div>
            <button className="x" aria-label="Tutup" onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
