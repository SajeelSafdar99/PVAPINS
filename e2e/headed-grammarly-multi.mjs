import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.APP_URL || "http://localhost:3000";
const GRAMMARLY = "https://app.grammarly.com/";
const ADMIN_EMAIL = "moinakbarali@gmail.com";
const ADMIN_PASSWORD = "12345678";
const DEMO_EMAIL = "demo.multidevice@example.com";
const DEMO_PASSWORD = "DemoUser12!";
const OUT_DIR = path.join(process.cwd(), "test-results");
const WAIT_MS = Number(process.env.LOGIN_WAIT_MS || 300000);

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

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: false,
      channel: "chrome",
      slowMo: 40,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return await chromium.launch({ headless: false, slowMo: 40 });
  }
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

async function captureGrammarly(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  console.log("HEADLESS=false Grammarly window is open. Sign in there. I will wait.");
  await page.goto(GRAMMARLY, { waitUntil: "domcontentloaded", timeout: 45000 });

  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const url = page.url();
    const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 2000);
    if (signedIn(url, text)) {
      const cookies = fromPlaywrightCookies(await context.cookies());
      const hasGrauth = cookies.some((cookie) => cookie.name === "grauth");
      console.log("captured", cookies.length, "cookies, grauth:", hasGrauth, "url:", url);
      if (!hasGrauth) throw new Error("Signed in, but grauth cookie was missing.");
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        source: "grammarly-web",
        cookies,
        storage: {},
        summary: { count: cookies.length, hasGrauth: true },
      };
      const out = path.join(OUT_DIR, "grammarly-session-headed.json");
      fs.writeFileSync(out, JSON.stringify(payload, null, 2));
      await page.screenshot({ path: path.join(OUT_DIR, "grammarly-capture.png"), fullPage: true });
      await context.close();
      return payload;
    }
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "grammarly-still-login.png"), fullPage: true });
  await context.close();
  throw new Error("Timed out waiting for Grammarly login.");
}

async function adminAssignHeaded(browser, payload) {
  const admin = await loginApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  await api("/api/admin/users", {
    token: admin.token,
    method: "POST",
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  const assigned = await api("/api/admin/sessions", { token: admin.token, method: "POST", body: payload });
  if (!assigned.ok) throw new Error(assigned.data.error || "Assign failed");

  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await context.addCookies([
    {
      name: "pvapins_token",
      value: admin.token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`${SITE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, "admin-after-assign.png"), fullPage: true });
  console.log("admin assigned session to", assigned.data.assigned, "users");
  return { context, page, admin };
}

async function userLogin(browser, label) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForURL(/\/dashboard/, { timeout: 30000 }).catch(() => null);
  if (!/\/dashboard/.test(page.url())) {
    const loggedIn = await loginApi(DEMO_EMAIL, DEMO_PASSWORD);
    await context.addCookies([
      {
        name: "pvapins_token",
        value: loggedIn.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.evaluate((token) => sessionStorage.setItem("pvapins_token", token), loggedIn.token);
    await page.goto(`${SITE}/dashboard`, { waitUntil: "domcontentloaded" });
  }
  const token = await page.evaluate(() => sessionStorage.getItem("pvapins_token"));
  const me = await api("/api/auth/me", { token });
  const session = await api("/api/sessions/me", { token });
  await page.screenshot({ path: path.join(OUT_DIR, `${label}-dashboard.png`), fullPage: true });
  console.log(label, "dashboard", page.url(), me.data.user?.email, "session", session.ok);
  return { context, page, token, payload: session.data.payload, email: me.data.user?.email, sessionOk: session.ok };
}

async function applyGrammarly(browser, label, payload) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await context.addCookies(toPlaywrightCookies(payload.cookies));
  const page = await context.newPage();
  await page.goto(GRAMMARLY, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(6000);
  const url = page.url();
  const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 1500);
  const ok = signedIn(url, text);
  await page.screenshot({ path: path.join(OUT_DIR, `${label}-grammarly.png`), fullPage: true });
  console.log(label, "grammarly apply", ok, url);
  return { context, page, ok, url };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const captureBrowser = await launchBrowser();
  let payload;
  try {
    payload = await captureGrammarly(captureBrowser);
  } finally {
    await captureBrowser.close();
  }

  const adminBrowser = await launchBrowser();
  const userA = await launchBrowser();
  const userB = await launchBrowser();
  const applyA = await launchBrowser();
  const applyB = await launchBrowser();
  try {
    await adminAssignHeaded(adminBrowser, payload);
    const [a, b] = await Promise.all([userLogin(userA, "device-a"), userLogin(userB, "device-b")]);
    const aStill = await api("/api/auth/me", { token: a.token });
    const bStill = await api("/api/auth/me", { token: b.token });
    const [gA, gB] = await Promise.all([
      applyGrammarly(applyA, "device-a", a.payload || payload),
      applyGrammarly(applyB, "device-b", b.payload || payload),
    ]);

    console.log("\n=== result ===");
    console.log("same user both dashboards", a.email === DEMO_EMAIL && b.email === DEMO_EMAIL);
    console.log("device-a token still valid", aStill.ok);
    console.log("device-b token still valid", bStill.ok);
    console.log("device-a grammarly", gA.ok, gA.url);
    console.log("device-b grammarly", gB.ok, gB.url);

    const failures = [];
    if (a.email !== DEMO_EMAIL || b.email !== DEMO_EMAIL) failures.push("demo user did not stay signed in on both site windows");
    if (!aStill.ok) failures.push("device-a site token died");
    if (!bStill.ok) failures.push("device-b site token died");
    if (!a.sessionOk || !b.sessionOk) failures.push("a user could not fetch the assigned session");
    if (!gA.ok) failures.push("device-a Grammarly apply still signed out");
    if (!gB.ok) failures.push("device-b Grammarly apply still signed out");
    if (failures.length) throw new Error(failures.join("\n"));
    console.log("\nPassed: same user on two browsers, session applied on both.");
    await new Promise((resolve) => setTimeout(resolve, 20000));
  } finally {
    await adminBrowser.close();
    await userA.close();
    await userB.close();
    await applyA.close();
    await applyB.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
