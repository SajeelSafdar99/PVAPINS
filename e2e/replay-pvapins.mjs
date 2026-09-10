import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_URL = "https://app.pvapins.com/user";
const OUT_DIR = path.join(process.cwd(), "test-results");
const SESSION_OUT = path.join(OUT_DIR, "pvapins-session-captured.json");
const LOGIN_WAIT_MS = Number(process.env.PVAPINS_LOGIN_WAIT_MS || 120000);

function sessionPath() {
  if (process.env.SESSION_JSON && fs.existsSync(process.env.SESSION_JSON)) {
    return process.env.SESSION_JSON;
  }
  const downloads = path.join(os.homedir(), "Downloads");
  if (!fs.existsSync(downloads)) return null;
  const files = fs
    .readdirSync(downloads)
    .filter((name) => /^pvapins-session-.*\.json$/i.test(name))
    .map((name) => path.join(downloads, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function isPvapinsDomain(domain) {
  const host = String(domain || "").replace(/^\./, "").toLowerCase();
  return host === "pvapins.com" || host.endsWith(".pvapins.com");
}

function mapSameSiteToPlaywright(value) {
  if (value === "no_restriction" || value === "None") return "None";
  if (value === "strict" || value === "Strict") return "Strict";
  return "Lax";
}

function mapSameSiteFromPlaywright(value) {
  if (value === "None") return "no_restriction";
  if (value === "Strict") return "strict";
  if (value === "Lax") return "lax";
  return "unspecified";
}

function toPlaywrightCookies(cookies) {
  return cookies.filter((cookie) => isPvapinsDomain(cookie.domain)).map((cookie) => {
    const item = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure) || cookie.sameSite === "no_restriction",
      sameSite: mapSameSiteToPlaywright(cookie.sameSite),
    };
    if (!cookie.session && typeof cookie.expirationDate === "number") {
      item.expires = cookie.expirationDate;
    } else {
      item.expires = -1;
    }
    return item;
  });
}

function fromPlaywrightCookies(cookies) {
  return cookies.filter((cookie) => isPvapinsDomain(cookie.domain)).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    httpOnly: Boolean(cookie.httpOnly),
    secure: Boolean(cookie.secure),
    sameSite: mapSameSiteFromPlaywright(cookie.sameSite),
    session: cookie.expires === -1 || cookie.expires == null,
    hostOnly: !String(cookie.domain || "").startsWith("."),
    expirationDate: cookie.expires && cookie.expires > 0 ? cookie.expires : undefined,
  }));
}

function looksSignedIn(url, text) {
  const loginPage =
    /continue with google/i.test(text) &&
    /sign in/i.test(text) &&
    /email address|password/i.test(text);
  const loginUrl = /\/login\b|\/signin\b/i.test(url);
  return {
    loginPage,
    loginUrl,
    likelySignedIn: !loginPage && !loginUrl,
  };
}

async function readPage(page) {
  const url = page.url();
  const title = await page.title();
  const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 2000);
  return { url, title, text, verdict: looksSignedIn(url, text) };
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

async function launchBrowser() {
  const launch = {
    headless: false,
    channel: "chrome",
    slowMo: 80,
    args: ["--disable-blink-features=AutomationControlled"],
  };
  try {
    return await chromium.launch(launch);
  } catch (error) {
    console.warn("Chrome channel failed, falling back to Chromium:", error.message);
    return await chromium.launch({ headless: false, slowMo: 80 });
  }
}

async function captureFromPage(page, context) {
  const storage = await page.evaluate(() => {
    const read = (bag) => {
      const out = {};
      for (let i = 0; i < bag.length; i += 1) {
        const key = bag.key(i);
        if (key != null) out[key] = bag.getItem(key);
      }
      return out;
    };
    return { local: read(localStorage), session: read(sessionStorage) };
  });

  const cookies = fromPlaywrightCookies(await context.cookies());
  if (cookies.length === 0) {
    throw new Error("Capture found no pvapins.com cookies.");
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "pvapins-web",
    cookies,
    storage: { "https://app.pvapins.com": storage },
    summary: { count: cookies.length, names: cookies.map((cookie) => cookie.name).sort() },
  };
}

async function waitForSignedIn(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await readPage(page);
    if (snapshot.verdict.likelySignedIn) return snapshot;
    await page.waitForTimeout(1500);
  }
  return readPage(page);
}

async function captureSession(browser) {
  const existing = sessionPath();
  if (existing) {
    console.log("using existing session", existing);
    return JSON.parse(fs.readFileSync(existing, "utf8"));
  }

  console.log("No PVAPins JSON found. Capture: sign in at", APP_URL, "in the headed window if needed.");
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  const snapshot = await waitForSignedIn(page, LOGIN_WAIT_MS);
  console.log("capture page", snapshot.url, snapshot.verdict);
  if (!snapshot.verdict.likelySignedIn) {
    await page.screenshot({ path: path.join(OUT_DIR, "pvapins-capture-login.png"), fullPage: true });
    await context.close();
    throw new Error("Capture still looks signed out. Sign in at app.pvapins.com/user in the headed Chrome window and rerun.");
  }

  const payload = await captureFromPage(page, context);
  fs.writeFileSync(SESSION_OUT, JSON.stringify(payload, null, 2));
  console.log("captured", payload.summary.count, "cookies ->", SESSION_OUT);
  console.log("cookie names:", payload.summary.names.join(", "));
  await context.close();
  return payload;
}

async function applySession(browser, payload, { withStorage, label }) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addCookies(toPlaywrightCookies(payload.cookies));
  const page = await context.newPage();

  if (withStorage) {
    await applyStorage(page, payload.storage);
  }

  await page.goto(APP_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(6000);
  const snapshot = await readPage(page);
  const shot = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const ctxCookies = await context.cookies("https://app.pvapins.com");
  console.log(`\n=== ${label} ===`);
  console.log("url:", snapshot.url);
  console.log("title:", snapshot.title);
  console.log("verdict:", snapshot.verdict);
  console.log("body excerpt:", snapshot.text.replace(/\s+/g, " ").slice(0, 280));
  console.log("screenshot:", shot);
  console.log(
    "context cookies:",
    ctxCookies.map((cookie) => `${cookie.name}@${cookie.domain}`).join(", ")
  );

  await context.close();
  return snapshot;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await launchBrowser();
  try {
    const payload = await captureSession(browser);
    if (!Array.isArray(payload.cookies) || payload.cookies.length === 0) {
      throw new Error("Session JSON has no cookies.");
    }

    const cookiesOnly = await applySession(browser, payload, {
      withStorage: false,
      label: "pvapins-cookies-only",
    });
    const cookiesPlusStorage = await applySession(browser, payload, {
      withStorage: true,
      label: "pvapins-cookies-plus-storage",
    });

    const ok = cookiesOnly.verdict.likelySignedIn || cookiesPlusStorage.verdict.likelySignedIn;
    if (!ok) {
      throw new Error("Apply opened PVAPins but the page still looks signed out.");
    }
    console.log("\nPVAPins headed replay passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
