const statusEl = document.getElementById("status");
const apiUrlEl = document.getElementById("apiUrl");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const syncBtn = document.getElementById("syncBtn");
const autoRefreshEl = document.getElementById("autoRefresh");
const exportBtn = document.getElementById("exportBtn");
const targetEl = document.getElementById("target");
const demoCard = document.getElementById("demoCard");
const hintEl = document.getElementById("hint");
const authCard = document.getElementById("authCard");
const userCard = document.getElementById("userCard");
const whoEl = document.getElementById("who");

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function apiBase() {
  return apiUrlEl.value.trim().replace(/\/$/, "");
}

function selectedTarget() {
  const id = SessionLib.demoEnabled() ? targetEl.value : "grammarly";
  return SessionLib.getTarget(id);
}

function renderHint() {
  const target = selectedTarget();
  hintEl.innerHTML =
    target.id === "pvapins"
      ? "Stay logged in at <code>app.pvapins.com/user</code> in this Chrome profile, then export. You can be on any tab."
      : "Stay logged in at <code>app.grammarly.com</code> in this Chrome profile. Keep session fresh needs that login to stay alive.";
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function formatSync(lastSync) {
  if (!lastSync?.at) return "Signed in. Turn on Keep session fresh to push cookies automatically.";
  if (lastSync.error) return `Last sync failed ${new Date(lastSync.at).toLocaleString()}: ${lastSync.error}`;
  const expiry = lastSync.expiresAt ? ` Cookies expire ${new Date(lastSync.expiresAt).toLocaleString()}.` : "";
  if (lastSync.unchanged) {
    return `Last check ${new Date(lastSync.at).toLocaleString()}: cookies unchanged.${expiry}`;
  }
  return `Pushed to ${lastSync.assigned || "all"} users ${new Date(lastSync.at).toLocaleString()}.${expiry}`;
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
  if (!base) throw new Error("Set the API URL first.");
  await ensureApiAccess(base);
  const { token } = await chrome.storage.local.get("token");
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
  return data;
}

function renderAuth(user, lastSync) {
  const signedIn = Boolean(user);
  authCard.classList.toggle("hidden", signedIn);
  userCard.classList.toggle("hidden", !signedIn);
  whoEl.textContent = signedIn ? `Signed in as ${user.email}` : "";
  if (signedIn) {
    setStatus(formatSync(lastSync), lastSync?.error ? "bad" : lastSync?.at ? "ok" : "");
  }
}

async function restore() {
  const saved = await chrome.storage.local.get(["apiUrl", "token", "user", "autoRefresh", "lastSync"]);
  if (saved.apiUrl) apiUrlEl.value = saved.apiUrl;
  else if (typeof DEFAULT_API_URL === "string" && DEFAULT_API_URL) {
    apiUrlEl.value = DEFAULT_API_URL;
  }
  autoRefreshEl.checked = Boolean(saved.autoRefresh);
  if (saved.token && saved.user) {
    renderAuth(saved.user, saved.lastSync);
  } else {
    renderAuth(null);
    setStatus("Sign in as admin to keep the assigned session fresh, or just download a JSON.");
  }
}

if (SessionLib.demoEnabled()) {
  demoCard.classList.remove("hidden");
  targetEl.addEventListener("change", renderHint);
}
renderHint();

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
    if (data.user?.role !== "SUPER_ADMIN") {
      throw new Error("Use the admin account in this extension.");
    }
    await chrome.storage.local.set({ token: data.token, user: data.user });
    passwordEl.value = "";
    renderAuth(data.user);
    setStatus("Signed in. Turn on Keep session fresh while this Chrome profile stays on Grammarly.", "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user", "autoRefresh", "lastSync"]);
  autoRefreshEl.checked = false;
  await chrome.runtime.sendMessage({ type: "SET_AUTO_REFRESH", enabled: false });
  renderAuth(null);
  setStatus("Signed out. Automatic refresh is off.");
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
      ? "Keep session fresh is on. Leave Chrome open and stay logged into Grammarly."
      : "Automatic refresh is off.",
    enabled ? "ok" : ""
  );
});

syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  setStatus("Reading Grammarly cookies and assigning them…");
  try {
    await chrome.storage.local.set({ apiUrl: apiBase(), autoRefresh: true });
    autoRefreshEl.checked = true;
    const result = await chrome.runtime.sendMessage({ type: "SYNC_NOW" });
    if (result?.error) {
      setStatus(result.error, "bad");
      return;
    }
    setStatus(formatSync(result), "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    syncBtn.disabled = false;
  }
});

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  const target = selectedTarget();
  setStatus(`Reading ${target.label} cookies…`);

  try {
    const payload = await SessionLib.buildPayload(target.id);
    const json = JSON.stringify(payload, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    await chrome.downloads.download({
      url,
      filename: `${target.id}-session-${stamp()}.json`,
      saveAs: true,
    });

    const lines = [
      `Saved ${payload.summary.count} ${target.label} cookies.`,
      target.requiredCookie
        ? `${target.requiredCookie}: ${payload.summary.hasRequired ? "found" : "MISSING"}`
        : `Cookies found: ${payload.summary.count}`,
      "Upload this file on the admin website, or sign in above and push it from here.",
    ];
    setStatus(lines.join("\n"), payload.summary.hasRequired ? "ok" : "bad");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    exportBtn.disabled = false;
  }
});

restore();
