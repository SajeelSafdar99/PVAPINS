"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [note, setNote] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote("");
    setOk(false);
    try {
      const response = await api("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNote(data.error || "Could not change password.");
        return;
      }
      setNewPassword("");
      setOk(true);
      setNote("Password updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
      <div>
        <h2 className="text-lg font-semibold">Change password</h2>
        <p className="text-sm text-[#93a0b5]">You are already signed in. Enter a new password (8+ characters).</p>
      </div>
      <label className="block max-w-md text-sm text-[#93a0b5]">
        New password
        <input
          className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 text-[#e8eef8] outline-none focus:border-[#3dd6c6]"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      <button
        className="rounded-lg bg-[#3dd6c6] px-4 py-2.5 font-semibold text-[#06221f] disabled:opacity-60"
        disabled={busy}
      >
        {busy ? "Saving…" : "Update password"}
      </button>
      {note ? <p className={`text-sm ${ok ? "text-[#5ee6a0]" : "text-[#ff7b7b]"}`}>{note}</p> : null}
    </form>
  );
}
