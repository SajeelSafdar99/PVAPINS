import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const SITE = process.env.APP_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "moinakbarali@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo.multidevice@example.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoUser12!";
const OUT_DIR = path.join(process.cwd(), "test-results");
const DOWNLOADS = path.join(process.env.HOME || "", "Downloads");
const CAPTURE_WAIT_MS = Number(process.env.CAPTURE_WAIT_MS || 180000);

async function api(pathname, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${SITE}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function loginApi(email, password) {
  const response = await fetch(`${SITE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Login failed for ${email}: ${data.error || response.status}`);
  }
  return data;
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: false,
      channel: "chrome",
      slowMo: 50,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return await chromium.launch({ headless: false, slowMo: 50 });
  }
}

function listGrammarlySessions() {
  if (!fs.existsSync(DOWNLOADS)) return [];
  return fs
    .readdirSync(DOWNLOADS)
    .filter((name) => /^grammarly-session-.*\.json$/i.test(name))
    .map((name) => path.join(DOWNLOADS, name));
}

async function waitForFreshCapture(startedAt) {
  console.log("Log in to Grammarly, then export with Capture into Downloads.");
  const deadline = Date.now() + CAPTURE_WAIT_MS;
  while (Date.now() < deadline) {
    const fresh = listGrammarlySessions()
      .filter((file) => fs.statSync(file).mtimeMs > startedAt)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (fresh[0]) {
      console.log("fresh capture:", fresh[0]);
      return fresh[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("No new grammarly-session JSON appeared in Downloads.");
}

async function ensureDemoUser() {
  const admin = await loginApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  const created = await api("/api/admin/users", {
    token: admin.token,
    method: "POST",
    body: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  if (!created.ok && created.status !== 409) {
    throw new Error(created.data.error || "Could not create demo user");
  }
  console.log("demo user ready", DEMO_EMAIL);
  return admin;
}

async function adminAssign(browser, sessionFile) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
  await page.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForURL(/\/admin/, { timeout: 30000 });
  await page.locator('input[type="file"]').last().setInputFiles(sessionFile);
  await page.getByRole("button", { name: "Assign JSON" }).click();
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  const shot = path.join(OUT_DIR, "admin-assign.png");
  await page.screenshot({ path: shot, fullPage: true });
  const ok = /assigned to \d+ user/i.test(body);
  console.log("admin assign", ok ? "ok" : "check screenshot", shot);
  if (!ok) throw new Error("Admin assign did not confirm success.");
  return { context, page };
}

async function userLogin(browser, label) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${SITE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(DEMO_EMAIL);
  await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
  await page.locator("form").evaluate((form) => form.requestSubmit());
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1000);
  const token = await page.evaluate(() => sessionStorage.getItem("pvapins_token"));
  const me = await api("/api/auth/me", { token });
  const session = await api("/api/sessions/me", { token });
  const shot = path.join(OUT_DIR, `${label}-dashboard.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const result = {
    label,
    url: page.url(),
    email: me.data.user?.email || null,
    meOk: me.ok,
    sessionOk: session.ok,
    sessionError: session.data.error || null,
    shot,
  };
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(result, null, 2));
  return { context, page, token, result };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await ensureDemoUser();
  const startedAt = Date.now();
  const sessionFile = await waitForFreshCapture(startedAt);

  const adminBrowser = await launchBrowser();
  const deviceA = await launchBrowser();
  const deviceB = await launchBrowser();
  try {
    await adminAssign(adminBrowser, sessionFile);
    const [a, b] = await Promise.all([
      userLogin(deviceA, "device-a"),
      userLogin(deviceB, "device-b"),
    ]);

    const aStill = await api("/api/auth/me", { token: a.token });
    const bStill = await api("/api/auth/me", { token: b.token });
    console.log("\n=== after both user logins ===");
    console.log("device-a still valid", aStill.ok, aStill.data.user?.email);
    console.log("device-b still valid", bStill.ok, bStill.data.user?.email);

    const failures = [];
    if (!a.result.meOk) failures.push("device-a login failed");
    if (!b.result.meOk) failures.push("device-b login failed");
    if (a.result.email !== DEMO_EMAIL || b.result.email !== DEMO_EMAIL) {
      failures.push("both windows were not the same demo user");
    }
    if (!aStill.ok) failures.push("device-a was logged out after device-b signed in");
    if (!bStill.ok) failures.push("device-b token invalid");
    if (!a.result.sessionOk) failures.push(`device-a session fetch: ${a.result.sessionError}`);
    if (!b.result.sessionOk) failures.push(`device-b session fetch: ${b.result.sessionError}`);
    if (failures.length) throw new Error(failures.join("\n"));

    console.log("\nSame demo user is signed in on both browsers.");
    await new Promise((resolve) => setTimeout(resolve, 20000));
  } finally {
    await adminBrowser.close();
    await deviceA.close();
    await deviceB.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
