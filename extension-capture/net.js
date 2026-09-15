/**
 * Measured API failure diagnostics for Capture/Apply.
 * Reports only what we can verify (URL, permission, online, probe) — no guessed causes.
 */
const NetLib = {
  hostOf(base) {
    try {
      return new URL(base).host;
    } catch {
      return "";
    }
  },

  originOf(base) {
    try {
      return new URL(base).origin;
    } catch {
      return "";
    }
  },

  async resolveBase() {
    const { apiUrl } = await chrome.storage.local.get("apiUrl");
    return String(apiUrl || (typeof DEFAULT_API_URL === "string" ? DEFAULT_API_URL : "") || "").replace(
      /\/$/,
      ""
    );
  },

  async hasOriginAccess(base) {
    const origin = this.originOf(base);
    if (!origin) return false;
    try {
      return await chrome.permissions.contains({ origins: [`${origin}/*`] });
    } catch {
      return false;
    }
  },

  onlineFlag() {
    try {
      return typeof navigator !== "undefined" ? Boolean(navigator.onLine) : null;
    } catch {
      return null;
    }
  },

  async probe(base, timeoutMs = 8000) {
    const origin = this.originOf(base);
    if (!origin) return { ok: false, kind: "invalid", detail: "invalid origin" };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch(`${origin}/api/extensions`, {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      });
      return { ok: true, kind: "http", detail: `HTTP ${response.status}`, status: response.status };
    } catch (error) {
      const name = error && typeof error === "object" ? error.name : "";
      const message = error instanceof Error ? error.message : String(error);
      if (name === "AbortError") {
        return { ok: false, kind: "timeout", detail: `timed out after ${timeoutMs}ms` };
      }
      return { ok: false, kind: "network", detail: message || "network error" };
    } finally {
      clearTimeout(timer);
    }
  },

  async fetchJson(url, options = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: ctrl.signal });
      return response;
    } catch (error) {
      if (error && typeof error === "object" && error.name === "AbortError") {
        const timed = new Error(`Request timed out after ${timeoutMs}ms`);
        timed.name = "TimeoutError";
        timed.cause = error;
        throw timed;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },

  isOpaqueNetworkError(error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const name = error && typeof error === "object" ? error.name : "";
    return (
      name === "TimeoutError" ||
      name === "TypeError" ||
      /Failed to fetch|NetworkError|Load failed|network error|timed out/i.test(message)
    );
  },

  async explainFailure(base, error, context = "") {
    const pathNote = context ? ` (${context})` : "";
    const raw = error instanceof Error ? error.message : String(error || "Unknown error");
    const trimmed = String(base || "").trim();

    if (!trimmed) {
      return "API URL is empty. Set the site URL in the extension popup, then sign in again.";
    }

    const host = this.hostOf(trimmed);
    const origin = this.originOf(trimmed);
    if (!host || !origin) {
      return `API URL is invalid${pathNote}: ${trimmed.slice(0, 120)}`;
    }

    const online = this.onlineFlag();
    if (online === false) {
      return `Chrome reports offline while calling ${host}${pathNote}. Reconnect Wi‑Fi or disable airplane mode, then retry.`;
    }

    const permitted = await this.hasOriginAccess(trimmed);
    if (!permitted) {
      return `No Chrome host permission for ${host}${pathNote}. Open the extension popup and sign in so API access can be granted.`;
    }

    if (!this.isOpaqueNetworkError(error)) {
      return `${raw} [host=${host}]`;
    }

    const probe = await this.probe(trimmed);
    const onlineText = online == null ? "unknown" : String(online);

    if (error && typeof error === "object" && error.name === "TimeoutError") {
      return `Request to ${host}${pathNote} timed out. Probe: ${probe.detail}. online=${onlineText}; permission=yes.`;
    }

    if (probe.kind === "timeout") {
      return `Cannot complete request to ${host}${pathNote}: probe ${probe.detail}. online=${onlineText}; permission=yes.`;
    }

    if (probe.kind === "network") {
      return `Cannot reach ${host}${pathNote}: ${probe.detail}. online=${onlineText}; permission=yes. Likely DNS, TLS, firewall, or a temporary block to that host.`;
    }

    if (probe.ok) {
      return `Fetch to ${host}${pathNote} failed (${raw}), but a follow-up probe succeeded (${probe.detail}). Transient network blip or service-worker interruption. online=${onlineText}; permission=yes.`;
    }

    return `Network error calling ${host}${pathNote}: ${raw}. Probe: ${probe.detail}. online=${onlineText}; permission=yes.`;
  },
};
