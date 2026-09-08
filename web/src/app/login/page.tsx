"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.push(data.user?.role === "SUPER_ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
      <p className="mb-2 text-sm text-[#3dd6c6]">PVAPINS</p>
      <h1 className="mb-2 text-3xl font-semibold">Sign in</h1>
      <p className="mb-8 text-[#93a0b5]">
        Super admins assign a session JSON to each user. Users then download the
        apply extension and fetch that file.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 outline-none focus:border-[#3dd6c6]"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 outline-none focus:border-[#3dd6c6]"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
        <button
          className="w-full rounded-lg bg-[#3dd6c6] px-3 py-2 font-semibold text-[#06221f] disabled:opacity-60"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
