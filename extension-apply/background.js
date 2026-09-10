importScripts("config.js", "session.js");

const ALARM = "pvapins-user-sync";
const PERIOD_MINUTES = 5;

async function ensureApiAccess(base) {
  const origin = `${new URL(base).origin}/*`;
  const have = await chrome.permissions.contains({ origins: [origin] });
  if (!have) throw new Error("Open the Apply popup and sign in so API access can be granted.");
}

async function api(path) {
  const { apiUrl, token } = await chrome.storage.local.get(["apiUrl", "token"]);
  const base = String(apiUrl || DEFAULT_API_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Set the API URL first.");
  if (!token) throw new Error("Sign in first.");
  await ensureApiAccess(base);
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const next = response.headers.get("X-Pvapins-Token");
  if (next) await chrome.storage.local.set({ token: next });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
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

async function runPull() {
  try {
    await pullIfUpdated();
  } catch (error) {
    await chrome.storage.local.set({
      lastPull: {
        at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(autoRefresh !== false);
});

chrome.runtime.onStartup.addListener(async () => {
  const { autoRefresh } = await chrome.storage.local.get("autoRefresh");
  await scheduleRefresh(autoRefresh !== false);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) runPull();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "SET_AUTO_REFRESH") {
    scheduleRefresh(Boolean(message.enabled))
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "PULL_SESSION") {
    pullIfUpdated()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error instanceof Error ? error.message : String(error) }));
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
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});
