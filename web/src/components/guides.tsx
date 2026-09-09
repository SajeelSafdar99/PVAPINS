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
        title: "Click the Capture extension and choose Download session JSON.",
        detail: "The popup must say grauth: found. If it says missing, sign in to Grammarly again and export.",
      },
      {
        title: "Keep that JSON file. Users never upload it themselves.",
        detail: "Only you, as admin, can attach it to an account on the Users page.",
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
        title: "In Assign JSON, choose the file you exported and assign it.",
        detail: "That one file is applied to every user. Use it again when you have a new export.",
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
        title: "Click Fetch assigned session, then Apply and open Grammarly.",
        detail:
          "For Incognito: chrome://extensions → Apply → Details → Allow in Incognito, then open the popup from an Incognito window.",
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
