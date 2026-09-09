"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { api } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  hasSession: boolean;
  sessionUpdatedAt: string | null;
};

async function readSessionFile(file: File) {
  const payload = JSON.parse(await file.text());
  if (!payload || !Array.isArray(payload.cookies)) {
    throw new Error("That file is not a Grammarly session JSON.");
  }
  return payload;
}

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionFile, setSessionFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const assignRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function loadUsers() {
    const response = await api("/api/admin/users");
    if (!response.ok) return;
    setUsers(await response.json());
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!sessionFile) {
        setError("Choose a session JSON to assign to this user.");
        return;
      }
      const session = await readSessionFile(sessionFile);
      const response = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password, session }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not add user.");
        return;
      }
      setEmail("");
      setPassword("");
      setSessionFile(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add user.");
    } finally {
      setBusy(false);
    }
  }

  async function assignSession(id: string, file: File) {
    try {
      const session = await readSessionFile(file);
      const response = await api(`/api/admin/users/${id}/session`, {
        method: "POST",
        body: JSON.stringify(session),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not assign session.");
        return;
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign session.");
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Delete this user and their assigned session?")) return;
    await api(`/api/admin/users/${id}`, { method: "DELETE" });
    await loadUsers();
  }

  const people = users.filter((user) => user.role === "USER");

  return (
    <AppShell
      role="admin"
      email={adminEmail}
      current="/admin"
      title="Users and sessions"
      subtitle="Only you can upload JSON and create accounts. Users sign in later and fetch the file you assigned."
    >
      <form onSubmit={addUser} className="mb-8 space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
        <div>
          <h2 className="text-lg font-semibold">Add a user</h2>
          <p className="text-sm text-[#93a0b5]">Email, password, and a session JSON are all required.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#93a0b5]">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 text-[#e8eef8] outline-none focus:border-[#3dd6c6]"
              type="email"
              placeholder="user@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="text-sm text-[#93a0b5]">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 text-[#e8eef8] outline-none focus:border-[#3dd6c6]"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
        </div>
        <div>
          <p className="mb-2 text-sm text-[#93a0b5]">Session JSON to assign</p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#3dd6c6] bg-[#10141c] px-4 py-8 text-center hover:bg-[#0e1622]">
            <span className="font-semibold text-[#3dd6c6]">
              {sessionFile ? "Change file" : "Click to choose a .json file"}
            </span>
            <span className="mt-2 text-sm text-[#e8eef8]">
              {sessionFile ? sessionFile.name : "No file selected yet"}
            </span>
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => setSessionFile(e.target.files?.[0] || null)}
              required
            />
          </label>
        </div>
        <button
          className="rounded-lg bg-[#3dd6c6] px-4 py-2.5 font-semibold text-[#06221f] disabled:opacity-60"
          disabled={busy || !sessionFile}
        >
          {busy ? "Saving…" : "Add user and assign session"}
        </button>
        {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
      </form>

      <section className="mb-8 overflow-hidden rounded-2xl border border-[#2a3344] bg-[#181e29]">
        <div className="border-b border-[#2a3344] px-4 py-3">
          <h2 className="font-semibold">Assigned users</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#93a0b5]">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Session</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {people.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-[#93a0b5]" colSpan={3}>
                    No users yet. Add one above with a session JSON.
                  </td>
                </tr>
              ) : (
                people.map((user) => (
                  <tr key={user.id} className="border-t border-[#2a3344]">
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 text-[#93a0b5]">
                      {user.hasSession
                        ? `Assigned ${new Date(user.sessionUpdatedAt || "").toLocaleString()}`
                        : "None"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          className="text-[#3dd6c6]"
                          onClick={() => assignRefs.current[user.id]?.click()}
                        >
                          Replace JSON
                        </button>
                        <input
                          ref={(el) => {
                            assignRefs.current[user.id] = el;
                          }}
                          type="file"
                          accept="application/json,.json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) assignSession(user.id, file);
                            e.target.value = "";
                          }}
                        />
                        <button onClick={() => removeUser(user.id)} className="text-[#ff7b7b]">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <ExtensionDownload
          title="Capture extension"
          description="Admin only. Export a Grammarly session JSON from a logged-in Chrome profile, then assign it above."
          href="/downloads/pvapins-capture.zip"
          filename="pvapins-capture.zip"
        />
        <ExtensionDownload
          title="Apply extension (for users)"
          description="Users download this from their own dashboard. You can grab a copy here to test."
          href="/downloads/pvapins-apply.zip"
          filename="pvapins-apply.zip"
        />
      </div>
    </AppShell>
  );
}
