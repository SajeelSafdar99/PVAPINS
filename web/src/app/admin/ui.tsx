"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { AdminGuide } from "@/components/guides";
import { api } from "@/lib/api";
import { EXTENSIONS } from "@/lib/extensions";
import { LogsPanel } from "./logs-panel";

type UserRow = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  hasSession: boolean;
  sessionUpdatedAt: string | null;
  sessionExpiresAt: string | null;
};

type SessionKind = "none" | "active" | "expired";

function sessionStatus(user: UserRow): { label: string; detail: string; kind: SessionKind } {
  if (!user.hasSession) return { label: "None", detail: "No session assigned", kind: "none" };
  const assigned = user.sessionUpdatedAt
    ? `Assigned ${new Date(user.sessionUpdatedAt).toLocaleString()}`
    : "Assigned";
  if (!user.sessionExpiresAt) return { label: "Active", detail: assigned, kind: "active" };
  const expires = new Date(user.sessionExpiresAt);
  if (expires.getTime() <= Date.now()) {
    return { label: "Expired", detail: `${assigned} · recapture Grammarly`, kind: "expired" };
  }
  return { label: "Active", detail: `${assigned} · expires ${expires.toLocaleString()}`, kind: "active" };
}

const badgeClass: Record<SessionKind, string> = {
  none: "badge-muted",
  active: "badge-success",
  expired: "badge-danger",
};

const field = "field";

type TabKey = "home" | "users" | "logs" | "guide" | "password";

const TABS: { key: TabKey; label: string; title: string; subtitle: string }[] = [
  {
    key: "home",
    label: "Home",
    title: "Overview",
    subtitle: "Your workspace at a glance — session health and the extensions to hand out.",
  },
  {
    key: "users",
    label: "Users",
    title: "Users and sessions",
    subtitle:
      "Add accounts, assign a Grammarly session, and manage everyone. Keep Capture signed in on a Chrome profile that stays logged into Grammarly so cookies refresh by themselves.",
  },
  {
    key: "logs",
    label: "Logs",
    title: "Logs",
    subtitle: "Trace logins, session assigns, and extension errors. Tokens and cookie values are never stored.",
  },
  {
    key: "guide",
    label: "Admin guide",
    title: "Admin guide",
    subtitle: "Install Capture, export a Grammarly JSON, add users, and assign that file to everyone.",
  },
  {
    key: "password",
    label: "Password",
    title: "Change password",
    subtitle: "Update the password for your super-admin account.",
  },
];

async function readSessionFile(file: File) {
  const payload = JSON.parse(await file.text());
  if (!payload || !Array.isArray(payload.cookies)) {
    throw new Error("That file is not a session JSON.");
  }
  return payload;
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: SessionKind | "total" }) {
  const toneClass =
    tone === "active"
      ? "text-success"
      : tone === "expired"
        ? "text-danger"
        : tone === "none"
          ? "text-muted"
          : "text-accent";
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}

export function AdminDashboard({
  adminEmail,
  localDemo,
}: {
  adminEmail: string;
  localDemo: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("home");
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

  const people = useMemo(() => users.filter((user) => user.role === "USER"), [users]);

  const stats = useMemo(() => {
    let active = 0;
    let expired = 0;
    let none = 0;
    for (const user of people) {
      const kind = sessionStatus(user).kind;
      if (kind === "active") active += 1;
      else if (kind === "expired") expired += 1;
      else none += 1;
    }
    return { total: people.length, active, expired, none };
  }, [people]);

  async function fetchUsers(): Promise<UserRow[] | null> {
    const response = await api("/api/admin/users");
    if (!response.ok) return null;
    return (await response.json()) as UserRow[];
  }

  async function loadUsers() {
    const rows = await fetchUsers();
    if (rows) setUsers(rows);
  }

  useEffect(() => {
    let active = true;
    fetchUsers().then((rows) => {
      if (active && rows) setUsers(rows);
    });
    return () => {
      active = false;
    };
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

  const meta = TABS.find((item) => item.key === tab) ?? TABS[0];

  const tabBar = (
    <>
      {TABS.map((item) => {
        const active = item.key === tab;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition ${
              active
                ? "border-accent text-text"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {item.label}
            {item.key === "users" && stats.total > 0 ? (
              <span className="ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                {stats.total}
              </span>
            ) : null}
          </button>
        );
      })}
    </>
  );

  return (
    <AppShell
      role="admin"
      email={adminEmail}
      showNav={false}
      tabBar={tabBar}
      title={meta.title}
      subtitle={meta.subtitle}
    >
      {tab === "home" ? (
        <div className="space-y-8">
          {stats.expired > 0 ? (
            <div className="badge-danger w-full justify-start rounded-xl px-4 py-3 text-sm">
              {stats.expired} user{stats.expired === 1 ? "" : "s"} {stats.expired === 1 ? "has" : "have"} an expired
              session — keep the Capture browser signed into Grammarly so it can refresh them.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.total} tone="total" />
            <StatCard label="Active sessions" value={stats.active} tone="active" />
            <StatCard label="Expired" value={stats.expired} tone="expired" />
            <StatCard label="No session" value={stats.none} tone="none" />
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => setTab("users")}>
              Manage users
            </button>
            <button className="btn-ghost" onClick={() => setTab("logs")}>
              View logs
            </button>
            <button className="btn-ghost" onClick={() => setTab("guide")}>
              Read the admin guide
            </button>
          </div>

          <div>
            <h2 className="mb-1 text-lg font-semibold text-text">Downloads</h2>
            <p className="mb-4 text-sm text-muted">
              Install Capture yourself; users get Apply from their own dashboard.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <ExtensionDownload
                title="Capture extension"
                description="Admin only. Sign in here, stay logged into app.grammarly.com, and turn on Keep session fresh so assigned cookies update by themselves."
                href={EXTENSIONS.capture.path}
                filename={EXTENSIONS.capture.filename}
                version={EXTENSIONS.capture.version}
              />
              <ExtensionDownload
                title="Apply extension (for users)"
                description="Users download this from their own dashboard. You can grab a copy here to test."
                href={EXTENSIONS.apply.path}
                filename={EXTENSIONS.apply.filename}
                version={EXTENSIONS.apply.version}
              />
            </div>
          </div>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <form onSubmit={addUser} className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Add a user</h2>
                <p className="mt-1 text-sm text-muted">Email and password only. Assign JSON in the next card.</p>
              </div>
              <label className="label">
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
              <label className="label">
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
              <button className="btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Add user"}
              </button>
            </form>

            <form onSubmit={assignJson} className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Assign JSON</h2>
                <p className="mt-1 text-sm text-muted">
                  {localDemo
                    ? "Local demo: Grammarly or PVAPins session JSON. Production builds hide PVAPins. Capture can also push a live session without this upload."
                    : "Upload one Grammarly file, or leave Capture on “Keep session fresh” so it assigns new cookies when Grammarly refreshes them."}
                </p>
              </div>
              <label className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface-2 px-4 py-8 text-center transition hover:border-accent hover:bg-accent/5">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="mb-3 size-7 text-muted transition group-hover:text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16V4m0 0 4 4m-4-4L8 8" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
                <span className="font-semibold text-accent">
                  {jsonFile ? "Change file" : "Click to choose a .json file"}
                </span>
                <span className="mt-1.5 text-sm text-muted">
                  {jsonFile ? jsonFile.name : "No file selected yet"}
                </span>
                <input
                  className="sr-only"
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className="btn-primary" disabled={jsonBusy || !jsonFile || people.length === 0}>
                {jsonBusy ? "Assigning…" : "Assign JSON"}
              </button>
              {people.length === 0 ? (
                <p className="text-sm text-muted">Add at least one user before assigning a session.</p>
              ) : null}
              {jsonNote ? <p className="text-sm text-success">{jsonNote}</p> : null}
            </form>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <section className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="font-semibold text-text">Users</h2>
              <span className="badge-muted">{people.length} total</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-medium">Email</th>
                    <th className="px-5 py-3 font-medium">Session</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {people.length === 0 ? (
                    <tr>
                      <td className="px-5 py-10 text-center text-muted" colSpan={3}>
                        No users yet. Add one above, then assign a JSON.
                      </td>
                    </tr>
                  ) : (
                    people.map((user) => {
                      const status = sessionStatus(user);
                      return (
                        <tr key={user.id} className="border-t border-line transition hover:bg-surface-2/60">
                          <td className="px-5 py-3.5 font-medium text-text">{user.email}</td>
                          <td className="px-5 py-3.5">
                            <span className={badgeClass[status.kind]}>{status.label}</span>
                            <span className="mt-1 block text-xs text-muted">{status.detail}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex justify-end gap-1">
                              <button className="btn-ghost px-3 py-1.5" onClick={() => startEdit(user)}>
                                Edit
                              </button>
                              <button onClick={() => removeUser(user.id)} className="btn-danger px-3 py-1.5">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {editing ? (
            <form onSubmit={saveEdit} className="card space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-text">Edit user</h2>
                <p className="mt-1 text-sm text-muted">Leave password blank to keep the current one.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="label">
                  Email
                  <input
                    className={field}
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="label">
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
                <button className="btn-primary" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save user"}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
              {editNote ? <p className="text-sm text-success">{editNote}</p> : null}
            </form>
          ) : null}
        </div>
      ) : null}

      {tab === "logs" ? <LogsPanel /> : null}

      {tab === "guide" ? <AdminGuide /> : null}

      {tab === "password" ? (
        <div className="max-w-xl">
          <ChangePasswordForm />
        </div>
      ) : null}
    </AppShell>
  );
}
