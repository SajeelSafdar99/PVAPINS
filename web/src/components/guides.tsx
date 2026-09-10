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
        title: "Send the user this website URL plus their email and password.",
        detail: "They sign in as a user, download Apply, and fetch the session you assigned.",
      },
      {
        title: "Use Edit if you need to change a user’s email or password.",
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
        title: "Set the API URL to this website if it is empty.",
        detail: "Use the site address with no slash at the end, for example https://your-app.vercel.app",
      },
      {
        title: "Sign in with the same email and password you used on this website.",
        detail: "You cannot upload a JSON. The admin already stored one for your account.",
      },
      {
        title: "Click Fetch assigned session, then Apply and open Grammarly once.",
        detail:
          "Leave Apply signed in after that. It pulls a new copy when the admin refreshes the session. For Incognito: chrome://extensions → Apply → Details → Allow in Incognito, then open the popup from an Incognito window.",
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
