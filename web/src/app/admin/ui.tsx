"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { api } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  hasSession: boolean;
  sessionUpdatedAt: string | null;
  sessionExpiresAt: string | null;
};

function sessionStatus(user: UserRow) {
  if (!user.hasSession) return { text: "None", expired: false };
  const assigned = `Assigned ${new Date(user.sessionUpdatedAt || "").toLocaleString()}`;
  if (!user.sessionExpiresAt) return { text: assigned, expired: false };
  const expires = new Date(user.sessionExpiresAt);
  if (expires.getTime() <= Date.now()) {
    return { text: `${assigned} · Expired — recapture Grammarly`, expired: true };
  }
  return { text: `${assigned} · Expires ${expires.toLocaleString()}`, expired: false };
}

const field =
  "mt-1 w-full rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 text-[#e8eef8] outline-none focus:border-[#3dd6c6]";

async function readSessionFile(file: File) {
  const payload = JSON.parse(await file.text());
  if (!payload || !Array.isArray(payload.cookies)) {
    throw new Error("That file is not a session JSON.");
  }
  return payload;
}

export function AdminDashboard({
  adminEmail,
  localDemo,
}: {
  adminEmail: string;
  localDemo: boolean;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [error, setError] = useState("");
  const [jsonNote, setJsonNote] = useState("");
  const [editNote, setEditNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [jsonBusy, setJsonBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  const people = users.filter((user) => user.role === "USER");

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
      const response = await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not add user.");
        return;
      }
      setEmail("");
      setPassword("");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add user.");
    } finally {
      setBusy(false);
    }
  }

  async function assignJson(event: FormEvent) {
    event.preventDefault();
    setJsonBusy(true);
    setError("");
    setJsonNote("");
    try {
      if (!jsonFile) {
        setError("Choose a session JSON to assign.");
        return;
      }
      const session = await readSessionFile(jsonFile);
      const response = await api("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify(session),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not assign JSON.");
        return;
      }
      setJsonFile(null);
      setJsonNote(`Assigned to ${data.assigned} user${data.assigned === 1 ? "" : "s"}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign JSON.");
    } finally {
      setJsonBusy(false);
    }
  }

  function startEdit(user: UserRow) {
    setEditing(user);
    setEditEmail(user.email);
    setEditPassword("");
    setEditNote("");
    setError("");
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditBusy(true);
    setError("");
    setEditNote("");
    try {
      const body: { email: string; password?: string } = { email: editEmail };
      if (editPassword) body.password = editPassword;
      const response = await api(`/api/admin/users/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Could not update user.");
        return;
      }
      setEditNote("User updated.");
      setEditPassword("");
      setEditing({ ...editing, email: data.email || editEmail });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user.");
    } finally {
      setEditBusy(false);
    }
  }

  async function removeUser(id: string) {
    if (!confirm("Delete this user and their assigned session?")) return;
    await api(`/api/admin/users/${id}`, { method: "DELETE" });
    if (editing?.id === id) setEditing(null);
    await loadUsers();
  }

  return (
    <AppShell
      role="admin"
      email={adminEmail}
      current="/admin"
      title="Users and sessions"
      subtitle="Add accounts here. Keep Capture signed in on a Chrome profile that stays logged into Grammarly — it will push fresh cookies so users do not have to apply again."
    >
      <form onSubmit={addUser} className="mb-8 space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
        <div>
          <h2 className="text-lg font-semibold">Add a user</h2>
          <p className="text-sm text-[#93a0b5]">Email and password only. Assign JSON in the next section.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-[#93a0b5]">
            Email
            <input
              className={field}
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
              className={field}
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </label>
        </div>
        <button className="rounded-lg bg-[#3dd6c6] px-4 py-2.5 font-semibold text-[#06221f] disabled:opacity-60" disabled={busy}>
          {busy ? "Saving…" : "Add user"}
        </button>
        {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
      </form>

      <form onSubmit={assignJson} className="mb-8 space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
        <div>
          <h2 className="text-lg font-semibold">Assign JSON</h2>
          <p className="text-sm text-[#93a0b5]">
            {localDemo
              ? "Local demo: Grammarly or PVAPins session JSON. Production builds hide PVAPins. Capture can also push a live session without this upload."
              : "Upload one Grammarly file, or leave Capture on “Keep session fresh” so it assigns new cookies when Grammarly refreshes them on your machine."}
          </p>
        </div>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#3dd6c6] bg-[#10141c] px-4 py-8 text-center hover:bg-[#0e1622]">
          <span className="font-semibold text-[#3dd6c6]">{jsonFile ? "Change file" : "Click to choose a .json file"}</span>
          <span className="mt-2 text-sm text-[#e8eef8]">{jsonFile ? jsonFile.name : "No file selected yet"}</span>
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          className="rounded-lg bg-[#3dd6c6] px-4 py-2.5 font-semibold text-[#06221f] disabled:opacity-60"
          disabled={jsonBusy || !jsonFile || people.length === 0}
        >
          {jsonBusy ? "Assigning…" : "Assign JSON"}
        </button>
        {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
        {jsonNote ? <p className="text-sm text-[#5ee6a0]">{jsonNote}</p> : null}
      </form>

      <section className="mb-8 overflow-hidden rounded-2xl border border-[#2a3344] bg-[#181e29]">
        <div className="border-b border-[#2a3344] px-4 py-3">
          <h2 className="font-semibold">Users</h2>
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
                    No users yet. Add one above, then assign a JSON.
                  </td>
                </tr>
              ) : (
                people.map((user) => (
                  <tr key={user.id} className="border-t border-[#2a3344]">
                    <td className="px-4 py-3">{user.email}</td>
                    <td className={`px-4 py-3 ${sessionStatus(user).expired ? "text-[#ff7b7b]" : "text-[#93a0b5]"}`}>
                      {sessionStatus(user).text}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button className="text-[#3dd6c6]" onClick={() => startEdit(user)}>
                          Edit
                        </button>
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

      {editing ? (
        <form onSubmit={saveEdit} className="mb-8 space-y-4 rounded-2xl border border-[#2a3344] bg-[#181e29] p-6">
          <div>
            <h2 className="text-lg font-semibold">Edit user</h2>
            <p className="text-sm text-[#93a0b5]">Leave password blank to keep the current one.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-[#93a0b5]">
              Email
              <input
                className={field}
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </label>
            <label className="text-sm text-[#93a0b5]">
              New password
              <input
                className={field}
                type="password"
                placeholder="Optional"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                minLength={8}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-lg bg-[#3dd6c6] px-4 py-2.5 font-semibold text-[#06221f] disabled:opacity-60"
              disabled={editBusy}
            >
              {editBusy ? "Saving…" : "Save user"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-[#2a3344] px-4 py-2.5 text-[#93a0b5]"
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
          </div>
          {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
          {editNote ? <p className="text-sm text-[#5ee6a0]">{editNote}</p> : null}
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ExtensionDownload
          title="Capture extension"
          description="Admin only. Sign in here, stay logged into app.grammarly.com, and turn on Keep session fresh so assigned cookies update by themselves."
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

      <div className="mt-8">
        <ChangePasswordForm />
      </div>
    </AppShell>
  );
}
