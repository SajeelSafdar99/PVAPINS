"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExtensionDownload } from "@/components/ExtensionDownload";

export function UserDashboard({ email }: { email: string }) {
  const [sessionNote, setSessionNote] = useState("Checking for an assigned session…");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/sessions/status")
      .then(async (response) => {
        if (!response.ok) {
          setSessionNote("Could not check session status.");
          return;
        }
        const data = await response.json();
        setReady(Boolean(data.hasSession));
        setSessionNote(
          data.hasSession
            ? `A session was assigned to you on ${new Date(data.updatedAt).toLocaleString()}.`
            : "No session has been assigned yet. Ask the admin to attach a JSON to your account."
        );
      })
      .catch(() => setSessionNote("Could not check session status."));
  }, []);

  return (
    <AppShell
      role="user"
      email={email}
      current="/dashboard"
      title="Your extension"
      subtitle="Download Apply, then follow the User guide. You cannot upload a JSON — the admin already assigned one."
    >
      <p
        className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
          ready
            ? "border-[#1f3d34] bg-[#10241c] text-[#5ee6a0]"
            : "border-[#2a3344] bg-[#181e29] text-[#93a0b5]"
        }`}
      >
        {sessionNote}
      </p>

      <div className="max-w-md">
        <ExtensionDownload
          title="Apply extension"
          description="Install this, sign in with the same email and password, then fetch the Grammarly session assigned to you."
          href="/downloads/pvapins-apply.zip"
          filename="pvapins-apply.zip"
        />
      </div>
    </AppShell>
  );
}
