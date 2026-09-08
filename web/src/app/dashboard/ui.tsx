"use client";

import { useEffect, useState } from "react";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { Guide } from "@/components/Guide";
import { LogoutButton } from "@/components/LogoutButton";

export function UserDashboard({ email }: { email: string }) {
  const [sessionNote, setSessionNote] = useState("Checking for an assigned session…");

  useEffect(() => {
    fetch("/api/sessions/status")
      .then(async (response) => {
        if (!response.ok) {
          setSessionNote("Could not check session status.");
          return;
        }
        const data = await response.json();
        setSessionNote(
          data.hasSession
            ? `A session was assigned to you on ${new Date(data.updatedAt).toLocaleString()}.`
            : "No session has been assigned yet. Ask the admin to attach a JSON to your account."
        );
      })
      .catch(() => setSessionNote("Could not check session status."));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[#3dd6c6]">User</p>
          <h1 className="text-2xl font-semibold">Your extension</h1>
          <p className="text-sm text-[#93a0b5]">{email}</p>
        </div>
        <LogoutButton />
      </header>

      <p className="mb-6 rounded-xl border border-[#2a3344] bg-[#181e29] px-4 py-3 text-sm text-[#93a0b5]">
        {sessionNote}
      </p>

      <div className="mb-8 max-w-md">
        <ExtensionDownload
          title="Apply extension"
          description="Install this, sign in with the same email and password, then fetch the Grammarly session the admin assigned to you."
          href="/downloads/pvapins-apply.zip"
          filename="pvapins-apply.zip"
        />
      </div>

      <Guide
        title="User guide"
        steps={[
          "Download the Apply zip above and unzip it.",
          "Open chrome://extensions, turn on Developer mode, click Load unpacked, and choose the unzipped folder.",
          "Open the extension popup. The API URL should already be this website. Sign in with the same email and password you used here.",
          "Click Fetch assigned session. That pulls the JSON the admin stored for you.",
          "To use it in this browser, click Apply and open Grammarly. For Incognito, enable Allow in Incognito and open the popup from the Incognito window.",
          "You can also download the JSON file from the popup if you need a local copy.",
        ]}
      />
    </main>
  );
}
