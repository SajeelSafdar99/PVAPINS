"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, rememberToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      rememberToken(data.token);
      router.push(data.user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(61,214,198,0.14),_transparent_45%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-accent-ink shadow-[0_8px_24px_-10px_rgba(61,214,198,0.8)]"
          >
            PV
          </span>
          <p className="text-xs font-semibold tracking-[0.28em] text-accent">PVAPINS</p>
        </div>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight text-text">Sign in</h1>
        <p className="mb-8 text-muted">
          Admins assign a Grammarly session to each user. Users download Apply and fetch that file.
        </p>
        <form onSubmit={onSubmit} className="card space-y-4">
          <label className="label">
            Email
            <input
              className="field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="label">
            Password
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
