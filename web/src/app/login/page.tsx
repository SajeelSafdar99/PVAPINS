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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b1018] px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(61,214,198,0.12),_transparent_45%)]" />
      <div className="relative w-full max-w-md">
        <p className="mb-3 text-xs font-semibold tracking-[0.28em] text-[#3dd6c6]">PVAPINS</p>
        <h1 className="mb-2 text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="mb-8 text-[#93a0b5]">
          Admins assign a Grammarly session to each user. Users download Apply and fetch that file.
        </p>
        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29]/90 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
        >
          <label className="block text-sm text-[#93a0b5]">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2.5 text-[#e8eef8] outline-none focus:border-[#3dd6c6]"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-[#93a0b5]">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2.5 text-[#e8eef8] outline-none focus:border-[#3dd6c6]"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
          <button
            className="w-full rounded-lg bg-[#3dd6c6] px-3 py-2.5 font-semibold text-[#06221f] disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
