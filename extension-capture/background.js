importScripts("config.js", "session.js", "update.js");

const EXT_KIND = "capture";

const ALARM = "pvapins-admin-sync";
const PERIOD_MINUTES = 15;

async function ensureApiAccess(base) {
  const origin = `${new URL(base).origin}/*`;
  const have = await chrome.permissions.contains({ origins: [origin] });
  if (!have) throw new Error("Open the Capture popup and sign in so API access can be granted.");
}

async function api(path, options = {}) {
  const { apiUrl, token } = await chrome.storage.local.get(["apiUrl", "token"]);
  const base = String(apiUrl || DEFAULT_API_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Set the API URL first.");
  await ensureApiAccess(base);
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const next = response.headers.get("X-Pvapins-Token");
  if (next) await chrome.storage.local.set({ token: next });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  flushLogs().catch(() => {});
  return data;
}

async function warmGrammarly(target) {
  const tabs = await chrome.tabs.query({ url: target.tabUrl });
  const existing = tabs.find((tab) => /app\.grammarly\.com/i.test(tab.url || ""));
  if (existing?.id != null) {
    await SessionLib.waitForTabComplete(existing.id, 15000).catch(() => {});
    return;
  }
  const tab = await chrome.tabs.create({ url: target.appUrl, active: false });
  if (tab.id != null) {
    await SessionLib.waitForTabComplete(tab.id, 20000).catch(() => {});
  }
}

async function syncNow() {
  const { autoRefresh, token, user } = await chrome.storage.local.get(["autoRefresh", "token", "user"]);
  if (!autoRefresh || !token || user?.role !== "SUPER_ADMIN") {
    return { skipped: true };
  }

  const target = SessionLib.getTarget("grammarly");
  await SessionLib.ensureTargetAccess(target, { interactive: false });
  await warmGrammarly(target);
  const payload = await SessionLib.buildPayload(target.id, { interactive: false });
  if (target.requiredCookie && !payload.summary?.hasRequired) {
    throw new Error("grauth is missing. Sign in at app.grammarly.com in this Chrome profile.");
  }

  const data = await api("/api/admin/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const expiresAt = SessionLib.cookieExpiresAt(payload, target.requiredCookie);
  const lastSync = {
    at: new Date().toISOString(),
    unchanged: Boolean(data.unchanged),
    assigned: data.assigned,
    cookieCount: data.cookieCount,
    expiresAt: data.expiresAt || expiresAt,
    error: "",
  };
  await chrome.storage.local.set({ lastSync });
  return lastSync;
}

async function scheduleRefresh(enabled) {
  if (enabled) {
    await chrome.alarms.create(ALARM, { periodInMinutes: PERIOD_MINUTES, delayInMinutes: 1 });
  } else {
    await chrome.alarms.clear(ALARM);
  }
}

const PENDING_LOGS_KEY = "pendingLogs";
const MAX_PENDING_LOGS = 30;

async function enqueueLog(entry) {
  const { pendingLogs = [] } = await chrome.storage.local.get(PENDING_LOGS_KEY);
  pendingLogs.push({ ...entry, queuedAt: new Date().toISOString() });
  await chrome.storage.local.set({ [PENDING_LOGS_KEY]: pendingLogs.slice(-MAX_PENDING_LOGS) });
}

async function postLog(base, token, entry) {
  const response = await fetch(`${base}/api/logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      level: entry.level || "error",
      source: "capture",
      action: entry.action,
      message: String(entry.message).slice(0, 500),
    }),
  });
  return response.ok;
}

async function flushLogs() {
  const saved = await chrome.storage.local.get(["apiUrl", "token", PENDING_LOGS_KEY]);
  const base = String(saved.apiUrl || DEFAULT_API_URL || "").replace(/\/$/, "");
  const pending = Array.isArray(saved.pendingLogs) ? saved.pendingLogs : [];
  if (!base || !saved.token || pending.length === 0) return;
  const remaining = [];
  for (const entry of pending) {
    try {
      if (!(await postLog(base, saved.token, entry))) remaining.push(entry);
    } catch {
      remaining.push(entry);
    }
  }
  await chrome.storage.local.set({ [PENDING_LOGS_KEY]: remaining });
}

async function reportLog(action, message, level = "error") {
  const entry = { action, message: String(message), level };
  try {
    const { apiUrl, token } = await chrome.storage.local.get(["apiUrl", "token"]);
    const base = String(apiUrl || DEFAULT_API_URL || "").replace(/\/$/, "");
    if (!base || !token) {
      await enqueueLog(entry);
      return;
    }
    if (!(await postLog(base, token, entry))) {
      await enqueueLog(entry);
      return;
    }
    await flushLogs();
  } catch {
    await enqueueLog(entry);
  }
}

async function runSync() {
  try {
    const result = await syncNow();
    if (!result?.skipped && !result?.unchanged) {
      await reportLog("session.sync", `Pushed to ${result?.assigned || "users"}.`, "info");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await chrome.storage.local.set({
      lastSync: {
        at: new Date().toISOString(),
        error: message,
      },
    });
    await reportLog("session.sync", message);
  }
  checkForUpdate().catch(() => {});
}

async function checkForUpdate() {
  return UpdateLib.check(EXT_KIND);
}

chrome.runtime.onInstalled.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(Boolean(autoRefresh));
  checkForUpdate().catch(() => {});
});

chrome.runtime.onStartup.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(Boolean(autoRefresh));
  checkForUpdate().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) runSync();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_AUTO_REFRESH") {
    scheduleRefresh(Boolean(message.enabled))
      .then(() => {
        flushLogs().catch(() => {});
        sendResponse({ ok: true });
      })
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "REPORT_LOG") {
    reportLog(message.action || "client", message.message || "Unknown error", message.level || "error")
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "FLUSH_LOGS") {
    flushLogs()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === "CHECK_UPDATE") {
    checkForUpdate()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "DOWNLOAD_UPDATE") {
    UpdateLib.download(message.zipUrl, message.filename)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type !== "SYNC_NOW") return;

  (async () => {
    const { autoRefresh, token, user } = await chrome.storage.local.get(["autoRefresh", "token", "user"]);
    if (!token || user?.role !== "SUPER_ADMIN") {
      throw new Error("Sign in as admin first.");
    }
    if (!autoRefresh) {
      await chrome.storage.local.set({ autoRefresh: true });
      await scheduleRefresh(true);
    }
    return syncNow();
  })()
    .then(sendResponse)
    .catch((error) => {
      const messageText = error instanceof Error ? error.message : String(error);
      chrome.storage.local.set({
        lastSync: { at: new Date().toISOString(), error: messageText },
      });
      reportLog("session.sync", messageText);
      sendResponse({ error: messageText });
    });

  return true;
});
