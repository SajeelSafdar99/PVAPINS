"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { UserGuide } from "@/components/guides";
import { api } from "@/lib/api";
import { EXTENSIONS } from "@/lib/extensions";

type TabKey = "home" | "guide" | "password";

const TABS: { key: TabKey; label: string; title: string; subtitle: string }[] = [
  {
    key: "home",
    label: "Home",
    title: "Your extension",
    subtitle: "Download Apply and check your session. You cannot upload a JSON — the admin assigns one for you.",
  },
  {
    key: "guide",
    label: "User guide",
    title: "User guide",
    subtitle: "Install Apply, sign in, and apply your assigned Grammarly session.",
  },
  {
    key: "password",
    label: "Password",
    title: "Change password",
    subtitle: "Update the password for your account.",
  },
];

export function UserDashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<TabKey>("home");
  const [sessionNote, setSessionNote] = useState("Checking for an assigned session…");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api("/api/sessions/status")
      .then(async (response) => {
        if (!response.ok) {
          setSessionNote("Could not check session status.");
          return;
        }
        const data = await response.json();
        setReady(Boolean(data.hasSession));
        const assigned = data.hasSession
          ? `A session was assigned to you on ${new Date(data.updatedAt).toLocaleString()}.`
          : "No session has been assigned yet. Ask the admin to attach a JSON to your account.";
        const expiry =
          data.hasSession && data.expiresAt
            ? new Date(data.expiresAt).getTime() <= Date.now()
              ? " This copy is expired. Wait for the admin to refresh it, or ask them to recapture Grammarly."
              : ` Grammarly cookies expire ${new Date(data.expiresAt).toLocaleString()}. Keep Apply signed in so it can pull a refresh automatically.`
            : data.hasSession
              ? " Keep Apply signed in so it can pull a refresh when the admin updates the session."
              : "";
        setSessionNote(`${assigned}${expiry}`);
      })
      .catch(() => setSessionNote("Could not check session status."));
  }, []);

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
              active ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </>
  );

  return (
    <AppShell
      role="user"
      email={email}
      showNav={false}
      tabBar={tabBar}
      title={meta.title}
      subtitle={meta.subtitle}
    >
      {tab === "home" ? (
        <div className="space-y-6">
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              ready ? "border-success/30 bg-success/10 text-success" : "border-line bg-surface text-muted"
            }`}
          >
            {sessionNote}
          </p>
          <div className="max-w-md">
            <ExtensionDownload
              title="Apply extension"
              description="Install this, sign in with the same email and password, apply once, then leave it signed in. It will refresh Grammarly cookies when the admin pushes a new session."
              href={EXTENSIONS.apply.path}
              filename={EXTENSIONS.apply.filename}
              version={EXTENSIONS.apply.version}
            />
          </div>
        </div>
      ) : null}

      {tab === "guide" ? <UserGuide /> : null}

      {tab === "password" ? (
        <div className="max-w-xl">
          <ChangePasswordForm />
        </div>
      ) : null}
    </AppShell>
  );
}
