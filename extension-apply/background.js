importScripts("config.js", "session.js", "update.js", "net.js");

const EXT_KIND = "apply";

const ALARM = "pvapins-user-sync";
const PERIOD_MINUTES = 5;

async function ensureApiAccess(base) {
  const origin = `${new URL(base).origin}/*`;
  const have = await chrome.permissions.contains({ origins: [origin] });
  if (!have) {
    throw new Error(
      `No Chrome host permission for ${NetLib.hostOf(base) || base}. Open the Apply popup and sign in so API access can be granted.`
    );
  }
}

async function api(path) {
  const base = String(DEFAULT_API_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("API URL is not configured in this extension build.");
  await chrome.storage.local.set({ apiUrl: base });
  const { token } = await chrome.storage.local.get(["token"]);
  if (!token) throw new Error("Sign in first.");
  await ensureApiAccess(base);
  let response;
  try {
    response = await NetLib.fetchJson(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    throw new Error(await NetLib.explainFailure(base, error, path));
  }
  const next = response.headers.get("X-Pvapins-Token");
  if (next) await chrome.storage.local.set({ token: next });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}) at ${NetLib.hostOf(base)}${path}`);
  }
  flushLogs().catch(() => {});
  return data;
}

async function applyCookiesOnly(payload, storeId) {
  const target = SessionLib.targetFromPayload(payload);
  if (target.demo && !SessionLib.demoEnabled()) {
    throw new Error("This session type is only available in the local demo.");
  }
  await SessionLib.ensureTargetAccess(target, { interactive: false });
  const cookieResult = await SessionLib.applyCookies(payload.cookies, storeId, target);
  const auth = await SessionLib.readAuthCookies(storeId, target);
  return { storeId, cookieResult, auth, silent: true };
}

async function pullIfUpdated() {
  const saved = await chrome.storage.local.get([
    "autoRefresh",
    "token",
    "user",
    "lastAppliedUpdatedAt",
    "lastStoreId",
  ]);
  if (!saved.autoRefresh || !saved.token || saved.user?.role !== "USER") {
    return { skipped: true };
  }

  const status = await api("/api/sessions/status");
  if (!status.hasSession) {
    throw new Error("No session assigned yet.");
  }
  if (status.updatedAt && status.updatedAt === saved.lastAppliedUpdatedAt) {
    return { unchanged: true, updatedAt: status.updatedAt, expiresAt: status.expiresAt };
  }

  const data = await api("/api/sessions/me");
  const result = await applyCookiesOnly(data.payload, saved.lastStoreId);
  await chrome.storage.local.set({
    lastAppliedUpdatedAt: data.updatedAt,
    lastPull: {
      at: new Date().toISOString(),
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt || status.expiresAt,
      set: result.cookieResult.set,
      error: "",
    },
  });
  return { ...result, updatedAt: data.updatedAt, expiresAt: data.expiresAt };
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
      source: "apply",
      action: entry.action,
      message: String(entry.message).slice(0, 500),
    }),
  });
  return response.ok;
}

async function flushLogs() {
  const saved = await chrome.storage.local.get(["token", PENDING_LOGS_KEY]);
  const base = String(DEFAULT_API_URL || "").replace(/\/$/, "");
  const pending = Array.isArray(saved.pendingLogs) ? saved.pendingLogs : [];
  if (!base || !saved.token || pending.length === 0) return;
  await chrome.storage.local.set({ apiUrl: base });
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
    const { token } = await chrome.storage.local.get(["token"]);
    const base = String(DEFAULT_API_URL || "").replace(/\/$/, "");
    if (!base || !token) {
      await enqueueLog(entry);
      return;
    }
    await chrome.storage.local.set({ apiUrl: base });
    if (!(await postLog(base, token, entry))) {
      await enqueueLog(entry);
      return;
    }
    await flushLogs();
  } catch {
    await enqueueLog(entry);
  }
}

async function describePullError(error) {
  const raw = error instanceof Error ? error.message : String(error);
  if (/host permission|API URL is empty|API URL is invalid|Chrome reports offline|Cannot reach|timed out|Transient network|Network error calling|Request failed \(/i.test(raw)) {
    return raw;
  }
  const base = await NetLib.resolveBase();
  return NetLib.explainFailure(base, error, "session.pull");
}

async function runPull() {
  try {
    const result = await pullIfUpdated();
    if (!result?.skipped && !result?.unchanged) {
      await reportLog("session.pull", `Applied ${result?.cookieResult?.set ?? 0} cookies.`, "info");
    }
  } catch (error) {
    const message = await describePullError(error);
    await chrome.storage.local.set({
      lastPull: {
        at: new Date().toISOString(),
        error: message,
      },
    });
    await reportLog("session.pull", message);
  }
  checkForUpdate().catch(() => {});
}

async function checkForUpdate() {
  return UpdateLib.check(EXT_KIND);
}

chrome.runtime.onInstalled.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(autoRefresh !== false);
  checkForUpdate().catch(() => {});
});

chrome.runtime.onStartup.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(autoRefresh !== false);
  checkForUpdate().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) runPull();
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

  if (message?.type === "PULL_SESSION") {
    pullIfUpdated()
      .then(sendResponse)
      .catch(async (error) => {
        const text = await describePullError(error);
        reportLog("session.pull", text);
        sendResponse({ error: text });
      });
    return true;
  }

  if (message?.type !== "APPLY_SESSION") return;

  (async () => {
    const { payload, windowId, storeId } = message;
    const target = SessionLib.targetFromPayload(payload);
    if (target.demo && !SessionLib.demoEnabled()) {
      throw new Error("This session type is only available in the local demo.");
    }
    await SessionLib.ensureTargetAccess(target);
    const cookieResult = await SessionLib.applyCookies(payload.cookies, storeId, target);
    const auth = await SessionLib.readAuthCookies(storeId, target);
    const storageResult = await SessionLib.applyStorage(payload.storage, windowId);
    const verify = await SessionLib.verifyAppLogin(windowId, target);
    return { storeId, cookieResult, auth, storageResult, verify };
  })()
    .then(sendResponse)
    .catch((error) => {
      const text = error instanceof Error ? error.message : String(error);
      reportLog("session.apply", text);
      sendResponse({ error: text });
    });

  return true;
});
