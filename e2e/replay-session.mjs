import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SESSION_PATH =
  process.env.SESSION_JSON ||
  path.join(
    process.env.HOME,
    "Downloads/grammarly-session-2026-09-08T19-25-58-096Z.json"
  );
const OUT_DIR = path.join(process.cwd(), "test-results");
const APP_URL = "https://app.grammarly.com/";

function mapSameSite(value) {
  if (value === "no_restriction") return "None";
  if (value === "strict") return "Strict";
  if (value === "lax") return "Lax";
  return "Lax";
}

function toPlaywrightCookies(cookies) {
  return cookies.map((cookie) => {
    const item = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure) || cookie.sameSite === "no_restriction",
      sameSite: mapSameSite(cookie.sameSite),
    };
    if (!cookie.session && typeof cookie.expirationDate === "number") {
      item.expires = cookie.expirationDate;
    } else {
      item.expires = -1;
    }
    return item;
  });
}

function cookieNames(header) {
  if (!header) return [];
  return header
    .split(";")
    .map((part) => part.split("=")[0].trim())
    .filter(Boolean);
}

function looksSignedIn(url, title, text) {
  const signedOutUrl = /signin|signup|\/login/i.test(url);
  const signedOutText = /log in to your grammarly|sign in with google|create an account/i.test(
    text
  );
  return {
    signedOutUrl,
    signedOutText,
    likelySignedIn: !signedOutUrl && /app\.grammarly\.com/i.test(url),
    title,
  };
}

async function applyStorage(page, storageByOrigin) {
  for (const [origin, bags] of Object.entries(storageByOrigin || {})) {
    await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.evaluate((payload) => {
      for (const [key, value] of Object.entries(payload.local || {})) {
        localStorage.setItem(key, value);
      }
      for (const [key, value] of Object.entries(payload.session || {})) {
        sessionStorage.setItem(key, value);
      }
    }, bags);
  }
}

async function inspect(page, label) {
  const url = page.url();
  const title = await page.title();
  const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 1500);
  const verdict = looksSignedIn(url, title, text);
  console.log(`\n=== ${label} ===`);
  console.log("url:", url);
  console.log("title:", title);
  console.log("verdict:", verdict);
  console.log("body excerpt:", text.replace(/\s+/g, " ").slice(0, 280));
  return { url, title, verdict, text };
}

async function runScenario(browser, payload, { withStorage, label }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const cookies = toPlaywrightCookies(payload.cookies);
  await context.addCookies(cookies);

  const page = await context.newPage();
  const authCookieHits = [];

  page.on("request", (request) => {
    const url = request.url();
    if (!/grammarly\.com/.test(url)) return;
    const names = cookieNames(request.headers().cookie);
    if (names.includes("grauth") || /auth|capi|app\.grammarly/.test(url)) {
      authCookieHits.push({
        method: request.method(),
        url: url.slice(0, 180),
        hasGrauth: names.includes("grauth"),
        hasCsrf: names.includes("csrf-token"),
        hasGac: names.includes("gac"),
        hasTdi: names.includes("tdi"),
        cookieCount: names.length,
      });
    }
  });

  if (withStorage) {
    await applyStorage(page, payload.storage);
  }

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(8000);

  const result = await inspect(page, label);
  const shot = path.join(OUT_DIR, `${label.replace(/\s+/g, "-")}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log("screenshot:", shot);
  console.log(
    "sample requests with cookie flags:",
    JSON.stringify(authCookieHits.slice(0, 12), null, 2)
  );

  const ctxCookies = await context.cookies("https://app.grammarly.com");
  console.log(
    "context cookies on app:",
    ctxCookies.map((c) => `${c.name}@${c.domain}`).join(", ")
  );

  await context.close();
  return result;
}

async function main() {
  if (!fs.existsSync(SESSION_PATH)) {
    throw new Error(`Session file not found: ${SESSION_PATH}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const payload = JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
  console.log("loaded", SESSION_PATH);
  console.log("cookies", payload.cookies.length, "grauth", payload.summary?.hasGrauth);

  const launch = {
    headless: false,
    channel: "chrome",
    slowMo: 80,
    args: ["--disable-blink-features=AutomationControlled"],
  };

  let browser;
  try {
    browser = await chromium.launch(launch);
  } catch (error) {
    console.warn("Chrome channel failed, falling back to Chromium:", error.message);
    browser = await chromium.launch({ headless: false, slowMo: 80 });
  }

  try {
    await runScenario(browser, payload, {
      withStorage: false,
      label: "cookies-only",
    });
    await runScenario(browser, payload, {
      withStorage: true,
      label: "cookies-plus-storage",
    });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
