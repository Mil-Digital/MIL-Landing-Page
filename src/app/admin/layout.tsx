import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/admin/Toast";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "Content Studio — MIL Digital", template: "%s · MIL Content Studio" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
