"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type LogRow = {
  id: string;
  createdAt: string;
  level: string;
  source: string;
  action: string;
  message: string;
  email: string | null;
  ip: string | null;
};

const levelClass: Record<string, string> = {
  info: "badge-muted",
  warn: "badge-warn",
  error: "badge-danger",
};

export function LogsPanel() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [level, setLevel] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function search() {
    setAppliedQ(q.trim());
  }

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (source) params.set("source", source);
    if (appliedQ.trim()) params.set("q", appliedQ.trim());

    function readLogs() {
      return api(`/api/admin/logs?${params.toString()}`).then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setError(data.error || "Could not load logs.");
          return;
        }
        setError("");
        setLogs(data.logs || []);
      });
    }

    readLogs();
    const timer = setInterval(() => {
      readLogs();
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [level, source, appliedQ]);

  async function refresh() {
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (source) params.set("source", source);
    if (appliedQ.trim()) params.set("q", appliedQ.trim());
    const response = await api(`/api/admin/logs?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not load logs.");
      return;
    }
    setError("");
    setLogs(data.logs || []);
  }

  async function clearLogs() {
    if (!confirm("Clear all stored logs?")) return;
    setBusy(true);
    await api("/api/admin/logs", { method: "DELETE" });
    await refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <label className="label">
          Level
          <select className="field" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </label>
        <label className="label">
          Source
          <select className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All</option>
            <option value="api">api</option>
            <option value="apply">apply</option>
            <option value="capture">capture</option>
          </select>
        </label>
        <label className="label min-w-56 flex-1">
          Search
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="email, action, or message"
            onKeyDown={(e) => {
              if (e.key === "Enter") search();
            }}
          />
        </label>
        <button className="btn-ghost" type="button" onClick={search}>
          Search
        </button>
        <button className="btn-ghost" type="button" onClick={() => refresh()}>
          Refresh
        </button>
        <button className="btn-danger" type="button" disabled={busy} onClick={clearLogs}>
          Clear
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="font-semibold text-text">Recent events</h2>
          <span className="badge-muted">{logs.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Level</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Who</th>
                <th className="px-5 py-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-muted" colSpan={6}>
                    No logs yet. Sign in, assign a session, or reproduce an extension error.
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className={levelClass[row.level] || "badge-muted"}>{row.level}</span>
                    </td>
                    <td className="px-5 py-3 text-muted">{row.source}</td>
                    <td className="px-5 py-3 font-medium text-text">{row.action}</td>
                    <td className="px-5 py-3 text-xs text-muted">
                      <div>{row.email || "—"}</div>
                      {row.ip ? <div>{row.ip}</div> : null}
                    </td>
                    <td className="max-w-xl px-5 py-3 text-text">{row.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
