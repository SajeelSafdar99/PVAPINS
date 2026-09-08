"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { Guide } from "@/components/Guide";
import { LogoutButton } from "@/components/LogoutButton";

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
    const response = await fetch("/api/admin/users");
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
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const response = await fetch(`/api/admin/users/${id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await loadUsers();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#3dd6c6]">Super admin</p>
          <h1 className="text-2xl font-semibold">Users and sessions</h1>
          <p className="text-sm text-[#93a0b5]">{adminEmail}</p>
        </div>
        <LogoutButton />
      </header>

      <form onSubmit={addUser} className="mb-8 space-y-3 rounded-2xl border border-[#2a3344] bg-[#181e29] p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 outline-none focus:border-[#3dd6c6]"
            type="email"
            placeholder="user@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="rounded-lg border border-[#2a3344] bg-[#10141c] px-3 py-2 outline-none focus:border-[#3dd6c6]"
            type="text"
            placeholder="Password (8+ chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <p className="mb-2 text-sm text-[#93a0b5]">Session JSON to assign</p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#3dd6c6] bg-[#10141c] px-4 py-6 text-center">
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
          className="rounded-lg bg-[#3dd6c6] px-4 py-2 font-semibold text-[#06221f] disabled:opacity-60"
          disabled={busy || !sessionFile}
        >
          Add user and assign session
        </button>
        {error ? <p className="text-sm text-[#ff7b7b]">{error}</p> : null}
      </form>

      <div className="mb-8 overflow-x-auto rounded-2xl border border-[#2a3344]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#181e29] text-[#93a0b5]">
            <tr>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[#2a3344]">
                <td className="px-4 py-3">
                  {user.email}
                  <div className="text-xs text-[#93a0b5]">{user.role}</div>
                </td>
                <td className="px-4 py-3 text-[#93a0b5]">
                  {user.hasSession
                    ? `Assigned ${new Date(user.sessionUpdatedAt || "").toLocaleString()}`
                    : "None"}
                </td>
                <td className="px-4 py-3 text-right">
                  {user.role === "USER" ? (
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
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <ExtensionDownload
          title="Capture extension (admin)"
          description="Install this on a browser already logged into Grammarly. Export the session JSON, then assign that file to a user above."
          href="/downloads/pvapins-capture.zip"
          filename="pvapins-capture.zip"
        />
        <ExtensionDownload
          title="User extension (apply)"
          description="This is what users download. They sign in and pull the JSON you assigned."
          href="/downloads/pvapins-apply.zip"
          filename="pvapins-apply.zip"
        />
      </div>

      <Guide
        title="Admin guide"
        steps={[
          "Download Capture, load it unpacked, and export a Grammarly session JSON from a logged-in Chrome profile.",
          "Add a user with email, password, and that JSON. The session is stored and assigned immediately.",
          "Send the user this website URL plus their email and password.",
          "They sign in here, download the Apply extension, sign in again inside the extension, and fetch the assigned JSON.",
          "This table shows Assigned when a JSON is stored for that user. Use Replace JSON to give them a new file.",
          "If you test Apply yourself, open it from Incognito and enable Allow in Incognito.",
        ]}
      />
    </main>
  );
}
