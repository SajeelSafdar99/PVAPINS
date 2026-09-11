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
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-text">Change password</h2>
        <p className="mt-1 text-sm text-muted">You are already signed in. Enter a new password (8+ characters).</p>
      </div>
      <label className="label block max-w-md">
        New password
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>
      <button className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
      {note ? <p className={`text-sm ${ok ? "text-success" : "text-danger"}`}>{note}</p> : null}
    </form>
  );
}
