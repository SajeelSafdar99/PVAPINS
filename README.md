# Grammarly session transfer test

This repo tests one question first: **if you are logged into Grammarly in one Chrome profile, can that web session be copied into Incognito (or another Chromium browser)?**

API auth and remote storage come later. Right now the two extensions talk through a local JSON file. That file is the same payload we will send to an API later.

## What this covers

- Grammarly **website** login (`app.grammarly.com`), not the official Grammarly Chrome extension’s private storage.
- Cookies (including HttpOnly `grauth`) plus any `localStorage` / `sessionStorage` from open Grammarly tabs.

Use this only with **your own** Grammarly account.

## Load the extensions

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. **Load unpacked** → `extension-capture`.
4. **Load unpacked** → `extension-apply`.
5. On **Grammarly Session Apply**, open **Details** and enable **Allow in Incognito**.

## Test: normal window → Incognito

1. In a normal Chrome window, log in at [https://app.grammarly.com](https://app.grammarly.com) and stay on that tab.
2. Click **Grammarly Session Capture** → **Export session JSON** and save the file.
3. Confirm the popup says `grauth: found`. If it says missing, you are not fully logged in — sign in again and export.
4. Open an **Incognito** window.
5. Click **Grammarly Session Apply** (from the Incognito toolbar) → choose the JSON → **Apply and open Grammarly**.
6. Check the Grammarly tab:
   - **Success:** you land in the app already logged in.
   - **Failure:** you get bounced to sign-in. The apply popup will say so.

## Test: another browser

Same steps, but load only `extension-apply` in the second Chromium browser (Chrome, Edge, Brave, another Chrome profile) and import the JSON there.

Playwright already replayed the exported JSON in a fresh headed Chrome window. **Cookies alone are enough** — Grammarly opened signed in. Incognito failed because the apply extension was writing cookies into the normal profile (`incognito: spanning`), not the Incognito cookie jar.

After pulling these fixes: reload **Grammarly Session Apply**, keep **Allow in Incognito** on, and click Apply from the Incognito toolbar. The popup now says whether the current window is Incognito and whether `grauth` is readable after apply.

## How to read the result

| Result | Meaning |
| --- | --- |
| Logged in after apply | Cookie transfer works. We can wire the API next. |
| `grauth` missing on export | Capture ran before a real Grammarly login. |
| Cookies write but sign-in page appears | Grammarly is rejecting a copied session (device, IP, token binding, or extra tokens we did not copy). |

## Website hub

The Vercel app in `web/` is the main login.

1. Super admin signs in, exports a Grammarly JSON with the Capture extension, then adds a user and assigns that JSON.
2. The user signs in, downloads the Apply extension, signs in inside the popup, and fetches the assigned session.
3. The admin table shows whether a JSON is assigned to each user.
