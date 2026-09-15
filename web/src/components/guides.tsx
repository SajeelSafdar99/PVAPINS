import { Guide, type GuideSection, installZipSteps } from "@/components/Guide";

export const adminGuideSections: GuideSection[] = [
  {
    title: "Install the Capture zip",
    steps: installZipSteps,
  },
  {
    title: "Export a Grammarly session",
    steps: [
      {
        title: "Log in to Grammarly in the same Chrome profile where Capture is installed.",
        detail: "Open app.grammarly.com and confirm you are signed in. You can then switch to any other tab.",
      },
      {
        title: "Click the Capture extension, sign in as admin, and turn on Keep session fresh.",
        detail:
          "Stay logged in at app.grammarly.com in that same Chrome profile. Capture rereads those cookies and assigns them to every user. You can still download a JSON if you want a backup.",
      },
      {
        title: "If grauth is missing or the admin page says Expired, sign in to Grammarly again.",
        detail: "We cannot mint a new Grammarly token. The live admin browser has to still be logged in.",
      },
    ],
  },
  {
    title: "Create users and assign the JSON",
    steps: [
      {
        title: "Open Users and add each person with an email and password.",
      },
      {
        title: "Assign JSON is optional if Capture is already pushing a live session.",
        detail: "Use the upload if you exported a file by hand. Capture’s keep-fresh toggle does the same assign automatically.",
      },
      {
        title: "Send the user https://seo.smspin.io plus their email and password.",
        detail: "They sign in as a user, download Apply, and fetch the session you assigned. Apply does not ask for a URL.",
      },
      {
        title: "Use Edit if you need to change a user’s email or password.",
      },
    ],
  },
  {
    title: "Trace problems in Logs",
    steps: [
      {
        title: "Open the Logs tab to see sign-ins, assigns, and extension errors.",
        detail:
          "Failed Apply fetches are queued on the user’s Chrome and sent when the API is reachable again. Passwords, tokens, and cookie values are never stored.",
      },
      {
        title: "When Capture’s popup offers an update, download the new zip and reload the unpacked folder.",
        detail: "Chrome will not overwrite an unpacked extension. Users see the same prompt in Apply.",
      },
    ],
  },
];

export const userGuideSections: GuideSection[] = [
  {
    title: "Install the Apply zip",
    steps: installZipSteps,
  },
  {
    title: "Fetch the session assigned to you",
    steps: [
      {
        title: "Open the Apply extension from Chrome’s toolbar.",
      },
      {
        title: "Sign in with the same email and password you used on this website.",
        detail: "Apply is already pointed at seo.smspin.io. You cannot upload a JSON — the admin already stored one for your account.",
      },
      {
        title: "Click Fetch assigned session, then Apply and open Grammarly once.",
        detail:
          "Leave Apply signed in after that. It pulls a new copy when the admin refreshes the session. For Incognito: chrome://extensions → Apply → Details → Allow in Incognito, then open the popup from an Incognito window.",
      },
      {
        title: "If the popup says a newer zip is available, download it and reload the unpacked folder.",
        detail:
          "Chrome cannot replace an unpacked extension by itself. Unzip the new file, then on chrome://extensions reload that folder (or Remove and Load unpacked again).",
      },
    ],
  },
];

export function AdminGuide() {
  return <Guide title="Admin guide" sections={adminGuideSections} />;
}

export function UserGuide() {
  return <Guide title="User guide" sections={userGuideSections} />;
}
