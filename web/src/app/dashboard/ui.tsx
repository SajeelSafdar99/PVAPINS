"use client";

import { useEffect, useState } from "react";
import { ExtensionDownload } from "@/components/ExtensionDownload";
import { Guide, installZipSteps } from "@/components/Guide";
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
        sections={[
          {
            title: "How to install the zip",
            steps: installZipSteps,
          },
          {
            title: "Sign in and fetch your session",
            steps: [
              {
                title: "Open the Apply extension from Chrome’s toolbar.",
              },
              {
                title: "Set the API URL to this website if it is empty.",
                detail: "Example: https://your-app.vercel.app with no slash at the end.",
              },
              {
                title: "Sign in with the same email and password you used on this website.",
              },
              {
                title: "Click Fetch assigned session.",
                detail: "That downloads the JSON the admin assigned to your account.",
              },
              {
                title: "Click Apply and open Grammarly.",
                detail:
                  "To use Incognito: chrome://extensions → the Apply extension → Details → Allow in Incognito, then open the popup from an Incognito window.",
              },
            ],
          },
        ]}
      />
    </main>
  );
}
