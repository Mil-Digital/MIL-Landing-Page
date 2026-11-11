"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forgot, setForgot] = useState(false);

  const next = (() => {
    const n = params.get("next") || "/admin";
    return n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await authClient.signIn.email({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(
        error.status === 429 ? "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
        : /invalid|password|credentials/i.test(error.message ?? "") ? "Email atau password salah."
        : error.message || "Login gagal.",
      );
      return;
    }
    window.location.href = next;
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand-mark">MIL</div>
        <h1>Masuk ke Content Studio</h1>
        <p className="sub">Kelola konten website MIL Digital.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="alert error" role="alert">{error}</div>}
          {forgot && (
            <div className="alert info" role="status">
              Untuk alasan keamanan, reset password dilakukan oleh pengelola website. Hubungi developer/pengelola untuk dibuatkan password baru.
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password" style={{ display: "flex" }}>
              Password
              <button type="button" className="btn ghost sm" style={{ marginLeft: "auto", height: 22 }} onClick={() => setForgot(true)}>
                Lupa password?
              </button>
            </label>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn primary block" disabled={busy || !email || !password} style={{ height: 38 }}>
            {busy && <span className="spinner" />} Masuk
          </button>
        </form>
        <p className="muted" style={{ fontSize: 12, marginTop: 18, textAlign: "center" }}>
          Akses hanya untuk admin yang telah diotorisasi.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
