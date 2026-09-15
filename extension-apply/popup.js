const statusEl = document.getElementById("status");
const apiUrlEl = document.getElementById("apiUrl");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const fetchBtn = document.getElementById("fetchBtn");
const applyBtn = document.getElementById("applyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const authCard = document.getElementById("authCard");
const userCard = document.getElementById("userCard");
const actionCard = document.getElementById("actionCard");
const whoEl = document.getElementById("who");
const autoRefreshEl = document.getElementById("autoRefresh");
const updateCard = document.getElementById("updateCard");
const updateText = document.getElementById("updateText");
const updateBtn = document.getElementById("updateBtn");
const extVersionEl = document.getElementById("extVersion");

let payload = null;
let assignedUpdatedAt = null;

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function apiBase() {
  return apiUrlEl.value.trim().replace(/\/$/, "");
}

async function ensureApiAccess(base) {
  const origin = `${new URL(base).origin}/*`;
  const have = await chrome.permissions.contains({ origins: [origin] });
  if (!have) {
    const granted = await chrome.permissions.request({ origins: [origin] });
    if (!granted) throw new Error("Permission to reach the API was denied.");
  }
}

async function api(path, options = {}) {
  const base = apiBase();
  if (!base) throw new Error("API URL is empty. Set the site URL in the Apply popup, then sign in again.");
  await ensureApiAccess(base);
  const { token } = await chrome.storage.local.get("token");
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await NetLib.fetchJson(`${base}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error(await NetLib.explainFailure(base, error, path));
  }
  const next = response.headers.get("X-Pvapins-Token");
  if (next) await chrome.storage.local.set({ token: next });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status}) at ${NetLib.hostOf(base)}${path}`);
  }
  return data;
}

function renderAuth(user) {
  const signedIn = Boolean(user);
  authCard.classList.toggle("hidden", signedIn);
  userCard.classList.toggle("hidden", !signedIn);
  actionCard.classList.toggle("hidden", !signedIn);
  whoEl.textContent = signedIn ? `Signed in as ${user.email}` : "";
}

function setPayload(next) {
  payload = SessionLib.parsePayload(next);
  const target = SessionLib.targetFromPayload(payload);
  const summary = payload.summary || SessionLib.summarizeCookies(payload.cookies, target);
  applyBtn.disabled = false;
  applyBtn.textContent = `Apply and open ${target.label}`;
  downloadBtn.disabled = false;
  return { summary, target };
}

function showUpdate(update) {
  if (!update?.available) {
    updateCard.classList.add("hidden");
    return;
  }
  updateText.textContent = `Update ${update.current} → ${update.latest}. Chrome cannot install a zip for you. Download it, unzip, then reload the unpacked folder on chrome://extensions.`;
  updateCard.classList.remove("hidden");
}

async function restoreUpdate() {
  extVersionEl.textContent = `v${chrome.runtime.getManifest().version}`;
  const { extensionUpdate } = await chrome.storage.local.get("extensionUpdate");
  showUpdate(extensionUpdate);
  chrome.runtime.sendMessage({ type: "CHECK_UPDATE" }, (result) => {
    if (chrome.runtime.lastError || result?.error || result?.skipped) return;
    showUpdate(result);
  });
}

updateBtn.addEventListener("click", async () => {
  const { extensionUpdate } = await chrome.storage.local.get("extensionUpdate");
  updateBtn.disabled = true;
  chrome.runtime.sendMessage(
    {
      type: "DOWNLOAD_UPDATE",
      zipUrl: extensionUpdate?.zipUrl,
      filename: extensionUpdate?.filename,
    },
    (result) => {
      updateBtn.disabled = false;
      if (result?.error) {
        setStatus(result.error, "bad");
        return;
      }
      setStatus(
        "Downloaded the new zip. Unzip it, open chrome://extensions, reload the unpacked folder (or Remove + Load unpacked).",
        "ok"
      );
    }
  );
});

async function restore() {
  const saved = await chrome.storage.local.get(["apiUrl", "token", "user", "autoRefresh", "lastPull"]);
  if (saved.apiUrl) apiUrlEl.value = saved.apiUrl;
  else if (typeof DEFAULT_API_URL === "string" && DEFAULT_API_URL) {
    apiUrlEl.value = DEFAULT_API_URL;
  }
  autoRefreshEl.checked = saved.autoRefresh !== false;
  if (saved.token && saved.user) {
    renderAuth(saved.user);
    if (saved.lastPull?.error) {
      setStatus(`Last automatic update failed: ${saved.lastPull.error}`, "bad");
    } else if (saved.lastPull?.at) {
      setStatus(
        `Signed in. Last automatic update ${new Date(saved.lastPull.at).toLocaleString()}.`,
        "ok"
      );
    } else {
      setStatus("Signed in. Fetch the session assigned to you, or leave this on to pull updates automatically.");
    }
  } else {
    renderAuth(null);
  }
}

apiUrlEl.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiBase() });
});

loginBtn.addEventListener("click", async () => {
  loginBtn.disabled = true;
  setStatus("Signing in…");
  try {
    await chrome.storage.local.set({ apiUrl: apiBase() });
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailEl.value.trim(),
        password: passwordEl.value,
      }),
    });
    if (data.user?.role === "SUPER_ADMIN") {
      throw new Error("Use a user account in this extension, not the super admin.");
    }
    await chrome.storage.local.set({ token: data.token, user: data.user, autoRefresh: true });
    autoRefreshEl.checked = true;
    await chrome.runtime.sendMessage({ type: "SET_AUTO_REFRESH", enabled: true });
    passwordEl.value = "";
    renderAuth(data.user);
    await chrome.runtime.sendMessage({ type: "FLUSH_LOGS" });
    setStatus("Signed in. Fetch once, apply, then leave this signed in for automatic updates.", "ok");
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    setStatus(text, "bad");
    chrome.runtime.sendMessage({ type: "REPORT_LOG", action: "auth.login", message: text });
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user", "lastAppliedUpdatedAt", "lastPull"]);
  await chrome.runtime.sendMessage({ type: "SET_AUTO_REFRESH", enabled: false });
  payload = null;
  applyBtn.disabled = true;
  downloadBtn.disabled = true;
  renderAuth(null);
  setStatus("Signed out. Automatic updates are off.");
});

autoRefreshEl.addEventListener("change", async () => {
  const enabled = autoRefreshEl.checked;
  await chrome.storage.local.set({ autoRefresh: enabled });
  const result = await chrome.runtime.sendMessage({ type: "SET_AUTO_REFRESH", enabled });
  if (result?.error) {
    setStatus(result.error, "bad");
    return;
  }
  setStatus(
    enabled
      ? "Automatic updates are on. Leave this extension signed in."
      : "Automatic updates are off.",
    enabled ? "ok" : ""
  );
});

fetchBtn.addEventListener("click", async () => {
  fetchBtn.disabled = true;
  setStatus("Fetching the session assigned to you…");
  try {
    const data = await api("/api/sessions/me");
    assignedUpdatedAt = data.updatedAt || null;
    const { summary, target } = setPayload(data.payload);
    setStatus(
      [
        `Fetched assigned ${target.label} session.`,
        `Cookies: ${summary.count ?? payload.cookies.length}`,
        target.requiredCookie
          ? `${target.requiredCookie}: ${summary.hasRequired || summary.hasGrauth ? "yes" : "no"}`
          : "",
        data.updatedAt ? `Assigned: ${data.updatedAt}` : "",
        data.expiresAt ? `Expires: ${data.expiresAt}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "ok"
    );
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    setStatus(text, "bad");
    chrome.runtime.sendMessage({ type: "REPORT_LOG", action: "session.fetch", message: text });
  } finally {
    fetchBtn.disabled = false;
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!payload) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  );
  await chrome.downloads.download({
    url,
    filename: `${SessionLib.targetFromPayload(payload).id}-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    saveAs: true,
  });
  setStatus("Downloaded the assigned JSON.", "ok");
});

applyBtn.addEventListener("click", async () => {
  if (!payload) return;
  applyBtn.disabled = true;
  const win = await chrome.windows.getCurrent();
  setStatus(
    win.incognito
      ? "Applying into this Incognito cookie jar…"
      : "Applying into this browser profile…"
  );

  try {
    const storeId = await SessionLib.currentCookieStoreId();
    await chrome.storage.local.set({ lastStoreId: storeId });
    const result = await chrome.runtime.sendMessage({
      type: "APPLY_SESSION",
      payload,
      windowId: win.id,
      storeId,
    });

    if (result?.error) {
      setStatus(result.error, "bad");
      chrome.runtime.sendMessage({ type: "REPORT_LOG", action: "session.apply", message: result.error });
      return;
    }

    const target = SessionLib.targetFromPayload(payload);
    const authOk = target.requiredCookie
      ? Boolean(result.auth?.[target.requiredCookie])
      : Boolean(result.auth?.any);
    const lines = [
      `Window: ${win.incognito ? "Incognito" : "normal"}`,
      `Site: ${target.label}`,
      `Cookies written: ${result.cookieResult.set}`,
      target.requiredCookie
        ? `${target.requiredCookie} readable after apply: ${authOk ? "yes" : "NO"}`
        : `Cookies readable after apply: ${authOk ? "yes" : "NO"}`,
    ];
    if (result.verify) {
      lines.push("", `Verify: ${result.verify.note}`, `URL: ${result.verify.url || "(unknown)"}`);
    }
    if (assignedUpdatedAt) {
      await chrome.storage.local.set({ lastAppliedUpdatedAt: assignedUpdatedAt });
    }
    setStatus(lines.join("\n"), authOk ? "ok" : "bad");
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    setStatus(text, "bad");
    chrome.runtime.sendMessage({ type: "REPORT_LOG", action: "session.apply", message: text });
  } finally {
    applyBtn.disabled = false;
  }
});

restore();
restoreUpdate();
