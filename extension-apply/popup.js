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

let payload = null;

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
  if (!base) throw new Error("Set the API URL first.");
  await ensureApiAccess(base);
  const { token } = await chrome.storage.local.get("token");
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
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
  const summary = payload.summary || SessionLib.summarizeCookies(payload.cookies);
  applyBtn.disabled = false;
  downloadBtn.disabled = false;
  return summary;
}

async function restore() {
  const saved = await chrome.storage.local.get(["apiUrl", "token", "user"]);
  if (saved.apiUrl) apiUrlEl.value = saved.apiUrl;
  else if (typeof DEFAULT_API_URL === "string" && DEFAULT_API_URL) {
    apiUrlEl.value = DEFAULT_API_URL;
  }
  if (saved.token && saved.user) {
    renderAuth(saved.user);
    setStatus("Signed in. Fetch the session assigned to you.");
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
    await chrome.storage.local.set({ token: data.token, user: data.user });
    passwordEl.value = "";
    renderAuth(data.user);
    setStatus("Signed in. Fetch the session assigned to you.", "ok");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "user"]);
  payload = null;
  applyBtn.disabled = true;
  downloadBtn.disabled = true;
  renderAuth(null);
  setStatus("Signed out.");
});

fetchBtn.addEventListener("click", async () => {
  fetchBtn.disabled = true;
  setStatus("Fetching the session assigned to you…");
  try {
    const data = await api("/api/sessions/me");
    const summary = setPayload(data.payload);
    setStatus(
      [
        "Fetched assigned session.",
        `Cookies: ${summary.count ?? payload.cookies.length}`,
        `grauth: ${summary.hasGrauth ? "yes" : "no"}`,
        data.updatedAt ? `Assigned: ${data.updatedAt}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      "ok"
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
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
    filename: `grammarly-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
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
    const result = await chrome.runtime.sendMessage({
      type: "APPLY_SESSION",
      payload,
      windowId: win.id,
      storeId,
    });

    if (result?.error) {
      setStatus(result.error, "bad");
      return;
    }

    const lines = [
      `Window: ${win.incognito ? "Incognito" : "normal"}`,
      `Cookies written: ${result.cookieResult.set}`,
      `grauth readable after apply: ${result.auth.grauth ? "yes" : "NO"}`,
    ];
    if (result.verify) {
      lines.push("", `Verify: ${result.verify.note}`, `URL: ${result.verify.url || "(unknown)"}`);
    }
    setStatus(lines.join("\n"), result.auth.grauth ? "ok" : "bad");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    applyBtn.disabled = false;
  }
});

restore();
