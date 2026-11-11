import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/components/admin/Shell";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: ReactNode }) {
  const { user, admin } = await getAdmin();
  if (!user) redirect("/admin/login");
  if (!admin) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <div className="brand-mark">MIL</div>
          <h1>Akses ditolak</h1>
          <p className="sub">
            Akun <b>{user.email}</b> berhasil login, tetapi belum terdaftar sebagai admin CMS. Hubungi pemilik website untuk diberikan akses.
          </p>
          <SignOutButton />
        </div>
      </div>
    );
  }
  return <Shell admin={{ email: admin.email, full_name: admin.full_name, role: admin.role }}>{children}</Shell>;
}
