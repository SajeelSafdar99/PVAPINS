import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SITE = process.env.APP_URL || "http://localhost:3000";
const GRAMMARLY = "https://app.grammarly.com/";
const ADMIN_EMAIL = "seo@smspin.io";
const ADMIN_PASSWORD = "12345678";
const DEMO_EMAIL = "demo.multidevice@example.com";
const DEMO_PASSWORD = "DemoUser12!";
const OUT_DIR = path.join(process.cwd(), "test-results");
const WAIT_MS = Number(process.env.LOGIN_WAIT_MS || 300000);
const ROOT = process.cwd();

function isGrammarlyDomain(domain) {
  const host = String(domain || "").replace(/^\./, "").toLowerCase();
  return host === "grammarly.com" || host.endsWith(".grammarly.com");
}

function fromPlaywrightCookies(cookies) {
  return cookies.filter((cookie) => isGrammarlyDomain(cookie.domain)).map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || "/",
    httpOnly: Boolean(cookie.httpOnly),
    secure: Boolean(cookie.secure),
    sameSite:
      cookie.sameSite === "None" ? "no_restriction" : String(cookie.sameSite || "lax").toLowerCase(),
    session: cookie.expires === -1 || cookie.expires == null,
    hostOnly: !String(cookie.domain || "").startsWith("."),
    expirationDate: cookie.expires && cookie.expires > 0 ? cookie.expires : undefined,
  }));
}

function toPlaywrightCookies(cookies) {
  return cookies.filter((cookie) => isGrammarlyDomain(cookie.domain)).map((cookie) => {
    const item = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || "/",
      httpOnly: Boolean(cookie.httpOnly),
      secure: Boolean(cookie.secure) || cookie.sameSite === "no_restriction",
      sameSite:
        cookie.sameSite === "no_restriction" ? "None" : cookie.sameSite === "strict" ? "Strict" : "Lax",
    };
    if (!cookie.session && typeof cookie.expirationDate === "number") item.expires = cookie.expirationDate;
    else item.expires = -1;
    return item;
  });
}

function signedIn(url, text) {
  const outUrl = /signin|signup|accounts\.google|\/login/i.test(url);
  const outText = /log in to your grammarly|sign in with google|sign in to continue to grammarly/i.test(text);
  return !outUrl && /app\.grammarly\.com/i.test(url) && !outText;
}

async function api(pathname, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${SITE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
}

async function loginApi(email, password) {
  const result = await api("/api/auth/login", { method: "POST", body: { email, password } });
  if (!result.ok) throw new Error(result.data.error || `Login failed (${result.status})`);
  return result.data;
}

async function waitForSite() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(SITE);
      if (response.ok || response.status === 307 || response.status === 308) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Site not reachable at ${SITE}`);
}

async function launchWithExtension(extensionDir) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "pvapins-ext-"));
  const options = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
    viewport: { width: 1280, height: 860 },
    ignoreDefaultArgs: ["--disable-extensions"],
  };
  return chromium.launchPersistentContext(userData, { ...options, channel: "chrome" });
}

async function launchChrome() {
  try {
    return await chromium.launch({
      headless: false,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return chromium.launch({ headless: false });
  }
}

async function siteLogin(browser, email, password, existing) {
  const data = existing || (await loginApi(email, password));
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await context.addCookies([
    {
      name: "pvapins_token",
      value: data.token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const dest = data.user?.role === "SUPER_ADMIN" ? `${SITE}/admin` : `${SITE}/dashboard`;
  await page.goto(dest, { waitUntil: "domcontentloaded" });
  await page.evaluate((token) => sessionStorage.setItem("pvapins_token", token), data.token);
  await page.reload({ waitUntil: "domcontentloaded" });
  const probe = await page.evaluate(async () => {
    const token = sessionStorage.getItem("pvapins_token");
    const response = await fetch("/api/admin/users", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    return {
      status: response.status,
      href: location.href,
      hasToken: Boolean(token),
      body: (await response.text()).slice(0, 300),
    };
  });
  console.log("site login", email, probe);
  await page.waitForTimeout(800);
  return { context, page, token: data.token, role: data.user?.role };
}

async function extensionId(context) {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceWorker", { timeout: 8000 });
  return new URL(worker.url()).host;
}

async function openPopup(context, id) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  return page;
}

async function waitForGrammarly(page) {
  console.log("HEADLESS=false Grammarly window is open. Sign in there. I will wait.");
  await page.goto(GRAMMARLY, { waitUntil: "domcontentloaded", timeout: 45000 });
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const url = page.url();
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 2000);
    if (signedIn(url, text)) return url;
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "refresh-grammarly-login.png"), fullPage: true });
  throw new Error("Timed out waiting for Grammarly login.");
}

function payloadFromContext(context, extra = {}) {
  return context.cookies().then((cookies) => {
    const list = fromPlaywrightCookies(cookies);
    if (!list.some((cookie) => cookie.name === "grauth")) {
      throw new Error("grauth cookie was missing after Grammarly login.");
    }
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      source: "grammarly-web",
      cookies: list,
      storage: {},
      summary: { count: list.length, hasGrauth: true },
      ...extra,
    };
  });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await waitForSite();

  const failures = [];
  const admin = await loginApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  await api("/api/admin/users", {
    token: admin.token,
    method: "POST",
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });

  const captureBrowser = await launchChrome();
  const captureContext = await captureBrowser.newContext({ viewport: { width: 1280, height: 860 } });
  const grammarlyPage = await captureContext.newPage();
  let livePayload;
  try {
    const grammarlyUrl = await waitForGrammarly(grammarlyPage);
    livePayload = await payloadFromContext(captureContext);
    fs.writeFileSync(path.join(OUT_DIR, "grammarly-session-headed.json"), JSON.stringify(livePayload, null, 2));
    await grammarlyPage.screenshot({ path: path.join(OUT_DIR, "grammarly-capture.png"), fullPage: true });
    console.log("captured", livePayload.cookies.length, "cookies, grauth:", true, "url:", grammarlyUrl);
  } finally {
    await captureBrowser.close();
  }

  const siteBrowser = await launchChrome();
  try {

    const firstAssign = await api("/api/admin/sessions", {
      token: admin.token,
      method: "POST",
      body: livePayload,
    });
    if (!firstAssign.ok) throw new Error(firstAssign.data.error || "Assign failed");
    const secondAssign = await api("/api/admin/sessions", {
      token: admin.token,
      method: "POST",
      body: livePayload,
    });
    console.log("assign 1", firstAssign.data);
    console.log("assign 2", secondAssign.data);

    if (!firstAssign.data.expiresAt) failures.push("assign response missing expiresAt");
    if (secondAssign.data.unchanged !== true) failures.push("second identical assign should be unchanged");

    const users = await api("/api/admin/users", { token: admin.token });
    const demo = (users.data || []).find((user) => user.email === DEMO_EMAIL);
    if (!demo?.sessionExpiresAt) failures.push("admin users API missing sessionExpiresAt");
    if (demo?.sessionExpiresAt && new Date(demo.sessionExpiresAt).getTime() <= Date.now()) {
      failures.push("fresh grauth already marked expired");
    }

    const adminUi = await siteLogin(siteBrowser, ADMIN_EMAIL, ADMIN_PASSWORD, admin);
    const table = await adminUi.page.locator("table").innerText();
    await adminUi.page.screenshot({ path: path.join(OUT_DIR, "admin-expiry.png"), fullPage: true });
    console.log("admin table:\n", table);
    if (!/Expires/i.test(table)) failures.push("admin table did not show Expires");
    if (/Expired — recapture/i.test(table)) failures.push("admin table marked a fresh session expired");
    if (!/demo\.multidevice@example\.com/i.test(table)) failures.push("admin table missing demo user");

    const user = await loginApi(DEMO_EMAIL, DEMO_PASSWORD);
    const before = await api("/api/sessions/status", { token: user.token });
    const afterUnchanged = await api("/api/admin/sessions", {
      token: admin.token,
      method: "POST",
      body: livePayload,
    });
    const after = await api("/api/sessions/status", { token: user.token });
    console.log("user status before", before.data);
    console.log("user status after unchanged push", after.data, afterUnchanged.data);
    if (after.data.updatedAt !== before.data.updatedAt) {
      failures.push("unchanged admin push moved updatedAt, which would make users re-apply for no reason");
    }
    if (!after.data.expiresAt) failures.push("user status missing expiresAt");

    const userUi = await siteLogin(siteBrowser, DEMO_EMAIL, DEMO_PASSWORD, user);
    await userUi.page.getByText(/assigned to you|Keep Apply signed in|expired/i).waitFor({ timeout: 10000 });
    const dashText = await userUi.page.locator("body").innerText();
    await userUi.page.screenshot({ path: path.join(OUT_DIR, "user-dashboard-refresh.png"), fullPage: true });
    console.log("dashboard note:", dashText.split("\n").slice(0, 20).join(" | "));
    if (!/Keep Apply signed in|pull a refresh|expires/i.test(dashText)) {
      failures.push("user dashboard did not mention automatic refresh");
    }

    const applyBrowser = await launchChrome();
    const applyPageContext = await applyBrowser.newContext({ viewport: { width: 1100, height: 800 } });
    await applyPageContext.addCookies(toPlaywrightCookies(livePayload.cookies));
    const gPage = await applyPageContext.newPage();
    await gPage.goto(GRAMMARLY, { waitUntil: "domcontentloaded", timeout: 45000 });
    await gPage.waitForTimeout(6000);
    const appliedUrl = gPage.url();
    const appliedText = (await gPage.locator("body").innerText().catch(() => "")).slice(0, 1500);
    const grammarlyOk = signedIn(appliedUrl, appliedText);
    await gPage.screenshot({ path: path.join(OUT_DIR, "refresh-apply-grammarly.png"), fullPage: true });
    console.log("grammarly after assigned cookies", grammarlyOk, appliedUrl);
    if (!grammarlyOk) failures.push("assigned cookies did not open Grammarly signed in");
    await applyBrowser.close();

    console.log("\n=== refresh test ===");
    console.log("expiresAt", firstAssign.data.expiresAt || demo?.sessionExpiresAt);
    console.log("second assign unchanged", secondAssign.data.unchanged === true);
    console.log("admin shows Expires", /Expires/i.test(table));
    console.log("user status stable after second push", after.data.updatedAt === before.data.updatedAt);
    console.log("grammarly still signed in", grammarlyOk);

    if (failures.length) throw new Error(failures.join("\n"));
    console.log("\nPassed: keep-fresh assign, unchanged skip, expiry UI, and Apply cookies still work.");
    await new Promise((resolve) => setTimeout(resolve, 8000));
  } finally {
    await siteBrowser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
