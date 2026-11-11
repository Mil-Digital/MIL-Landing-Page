"use client";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="btn block"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/admin/login";
      }}
    >
      Keluar & login dengan akun lain
    </button>
  );
}
