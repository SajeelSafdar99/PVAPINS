/**
 * Shared web-session helpers for capture and apply extensions.
 */
const SessionLib = {
  SESSION_VERSION: 1,

  TARGETS: {
    grammarly: {
      id: "grammarly",
      source: "grammarly-web",
      label: "Grammarly",
      domainRe: /(^|\.)grammarly\.com$/i,
      tabUrl: "*://*.grammarly.com/*",
      appUrl: "https://app.grammarly.com/",
      cookieUrl: "https://app.grammarly.com/",
      defaultHost: "app.grammarly.com",
      rootHost: "grammarly.com",
      authCookies: ["grauth", "csrf-token", "gac", "tdi"],
      requiredCookie: "grauth",
      origins: ["*://*.grammarly.com/*", "*://grammarly.com/*"],
    },
    pvapins: {
      id: "pvapins",
      source: "pvapins-web",
      label: "PVAPins",
      demo: true,
      domainRe: /(^|\.)pvapins\.com$/i,
      tabUrl: "*://*.pvapins.com/*",
      appUrl: "https://app.pvapins.com/user",
      cookieUrl: "https://app.pvapins.com/",
      defaultHost: "app.pvapins.com",
      rootHost: "pvapins.com",
      authCookies: ["u_access_token", "u_refresh_token"],
      requiredCookie: "u_access_token",
      origins: ["*://*.pvapins.com/*", "*://pvapins.com/*"],
    },
  },

  demoEnabled() {
    return typeof LOCAL_DEMO !== "undefined" && LOCAL_DEMO === true;
  },

  getTarget(id) {
    return this.TARGETS[id] || this.TARGETS.grammarly;
  },

  availableTargets() {
    return Object.values(this.TARGETS).filter((target) => !target.demo || this.demoEnabled());
  },

  isDomain(domain, target) {
    return target.domainRe.test(String(domain || "").replace(/^\./, ""));
  },

  targetFromPayload(payload) {
    if (payload?.source === "pvapins-web" && this.demoEnabled()) return this.TARGETS.pvapins;
    const cookies = Array.isArray(payload?.cookies) ? payload.cookies : [];
    if (this.demoEnabled() && cookies.some((cookie) => this.isDomain(cookie.domain, this.TARGETS.pvapins))) {
      if (!cookies.some((cookie) => cookie.name === "grauth")) return this.TARGETS.pvapins;
    }
    return this.TARGETS.grammarly;
  },

  async ensureTargetAccess(target, options = {}) {
    if (!target.origins?.length || typeof chrome.permissions?.contains !== "function") return;
    const have = await chrome.permissions.contains({ origins: target.origins });
    if (have) return;
    if (options.interactive === false || typeof chrome.permissions.request !== "function") {
      throw new Error(`Open the popup once so ${target.label} cookie access can be granted.`);
    }
    const granted = await chrome.permissions.request({ origins: target.origins });
    if (!granted) throw new Error(`Permission to read ${target.label} cookies was denied.`);
  },

  async currentCookieStoreId() {
    const win = await chrome.windows.getCurrent({ populate: true });
    const stores = await chrome.cookies.getAllCookieStores();
    const windowTabIds = new Set((win.tabs || []).map((tab) => tab.id));

    const storeForWindow = stores.find((store) =>
      store.tabIds.some((id) => windowTabIds.has(id))
    );
    if (storeForWindow) return storeForWindow.id;

    if (win.incognito) {
      const incognitoStore = stores.find((store) => store.id !== "0");
      if (incognitoStore) return incognitoStore.id;
    }

    return undefined;
  },

  async collectCookies(target) {
    const all = await chrome.cookies.getAll({});
    return all.filter((cookie) => this.isDomain(cookie.domain, target));
  },

  summarizeCookies(cookies, target) {
    const names = new Set(cookies.map((cookie) => cookie.name));
    return {
      count: cookies.length,
      hasGrauth: names.has("grauth"),
      hasCsrf: names.has("csrf-token"),
      hasRequired: target.requiredCookie ? names.has(target.requiredCookie) : cookies.length > 0,
      names: [...names].sort(),
    };
  },

  async collectPageStorage(target) {
    const tabs = await chrome.tabs.query({ url: target.tabUrl });
    const byOrigin = {};

    for (const tab of tabs) {
      if (tab.id == null) continue;
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const read = (storage) => {
              const out = {};
              for (let i = 0; i < storage.length; i += 1) {
                const key = storage.key(i);
                if (key != null) out[key] = storage.getItem(key);
              }
              return out;
            };
            return {
              origin: location.origin,
              local: read(localStorage),
              session: read(sessionStorage),
            };
          },
        });
        if (result?.origin) {
          byOrigin[result.origin] = {
            local: result.local || {},
            session: result.session || {},
          };
        }
      } catch (error) {
        console.warn("Could not read storage from tab", tab.id, error);
      }
    }

    return byOrigin;
  },

  async buildPayload(targetId, options = {}) {
    const target = this.getTarget(targetId);
    if (target.demo && !this.demoEnabled()) {
      throw new Error("That export is only available in the local demo.");
    }
    await this.ensureTargetAccess(target, options);
    const cookies = await this.collectCookies(target);
    const storage = await this.collectPageStorage(target);
    return {
      version: this.SESSION_VERSION,
      exportedAt: new Date().toISOString(),
      source: target.source,
      cookies,
      storage,
      summary: this.summarizeCookies(cookies, target),
    };
  },

  cookieUrl(cookie, target) {
    const host = String(cookie.domain || "").replace(/^\./, "");
    const path = cookie.path || "/";
    const scheme = cookie.secure || cookie.sameSite === "no_restriction" ? "https" : "http";
    const urlHost = host === target.rootHost ? target.defaultHost : host;
    return `${scheme}://${urlHost}${path}`;
  },

  toSetDetails(cookie, storeId, target) {
    const details = {
      url: this.cookieUrl(cookie, target),
      name: cookie.name,
      value: cookie.value,
      path: cookie.path || "/",
      secure: Boolean(cookie.secure) || cookie.sameSite === "no_restriction",
      httpOnly: Boolean(cookie.httpOnly),
    };

    if (storeId) {
      details.storeId = storeId;
    }

    if (!cookie.hostOnly && cookie.domain) {
      details.domain = cookie.domain;
    }

    if (cookie.sameSite && cookie.sameSite !== "unspecified") {
      details.sameSite = cookie.sameSite;
    }

    if (details.sameSite === "no_restriction") {
      details.secure = true;
    }

    if (!cookie.session && typeof cookie.expirationDate === "number") {
      details.expirationDate = cookie.expirationDate;
    }

    if (cookie.partitionKey) {
      details.partitionKey = cookie.partitionKey;
    }

    return details;
  },

  async applyCookies(cookies, storeId, target) {
    const results = { set: 0, failed: [] };
    for (const cookie of cookies) {
      if (!this.isDomain(cookie.domain, target)) continue;
      if (!cookie.session && cookie.expirationDate && cookie.expirationDate * 1000 < Date.now()) {
        results.failed.push({ name: cookie.name, error: "expired" });
        continue;
      }
      try {
        const written = await chrome.cookies.set(this.toSetDetails(cookie, storeId, target));
        if (written) results.set += 1;
        else results.failed.push({ name: cookie.name, domain: cookie.domain, error: "set returned empty" });
      } catch (error) {
        results.failed.push({
          name: cookie.name,
          domain: cookie.domain,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  },

  async readAuthCookies(storeId, target) {
    const query = { url: target.cookieUrl };
    if (storeId) query.storeId = storeId;
    const found = {};
    for (const name of target.authCookies) {
      const cookie = await chrome.cookies.get({ ...query, name });
      found[name] = Boolean(cookie);
    }
    if (!target.requiredCookie) {
      const all = await chrome.cookies.getAll({ ...query });
      found.any = all.length > 0;
    }
    return found;
  },

  async applyStorage(storageByOrigin, windowId) {
    const results = { origins: 0, failed: [] };
    if (!storageByOrigin || typeof storageByOrigin !== "object") return results;

    for (const [origin, bags] of Object.entries(storageByOrigin)) {
      try {
        const tab = await chrome.tabs.create({
          url: origin,
          active: false,
          windowId,
        });
        await this.waitForTabComplete(tab.id, 10000);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (payload) => {
            const write = (storage, entries) => {
              if (!entries) return;
              for (const [key, value] of Object.entries(entries)) {
                storage.setItem(key, value);
              }
            };
            write(localStorage, payload.local);
            write(sessionStorage, payload.session);
          },
          args: [bags],
        });
        await chrome.tabs.remove(tab.id);
        results.origins += 1;
      } catch (error) {
        results.failed.push({
          origin,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  },

  waitForTabComplete(tabId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        reject(new Error("tab load timeout"));
      }, timeoutMs);

      function onUpdated(id, info) {
        if (id === tabId && info.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === "complete") {
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      });
    });
  },

  async verifyAppLogin(windowId, target) {
    const tab = await chrome.tabs.create({
      url: target.appUrl,
      active: true,
      windowId,
    });
    const deadline = Date.now() + 15000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      let current;
      try {
        current = await chrome.tabs.get(tab.id);
      } catch {
        return { ok: null, url: "", note: "Verification tab was closed." };
      }
      if (current.status !== "complete") continue;

      const url = current.url || "";
      if (/signin|signup|\/login/i.test(url) && !/\/user$/i.test(url)) {
        return { ok: false, url, note: "Redirected to a sign-in page." };
      }

      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => ({
            href: location.href,
            title: document.title,
            text: (document.body?.innerText || "").slice(0, 2500),
          }),
        });
        const signedOut =
          /sign in|log in/i.test(result.text) &&
          /\/signin|\/login/i.test(result.href);
        if (signedOut) {
          return { ok: false, url: result.href, note: "App loaded but still looks signed out." };
        }
        return { ok: true, url: result.href, note: `${target.label} opened without a sign-in redirect.` };
      } catch {
        return { ok: null, url, note: "App opened. Confirm in the tab whether you are logged in." };
      }
    }

    const current = await chrome.tabs.get(tab.id);
    return {
      ok: null,
      url: current.url || "",
      note: `Timed out waiting for ${target.label}. Check the opened tab.`,
    };
  },

  parsePayload(raw) {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || !Array.isArray(data.cookies)) {
      throw new Error("Invalid session file: missing cookies array.");
    }
    return data;
  },

  cookieExpiresAt(payload, cookieName) {
    const cookies = Array.isArray(payload?.cookies) ? payload.cookies : [];
    const cookie =
      cookies.find((item) => item.name === cookieName) ||
      cookies.find((item) => item.name === "grauth") ||
      cookies.find((item) => item.name === "u_access_token");
    if (typeof cookie?.expirationDate !== "number") return null;
    return new Date(cookie.expirationDate * 1000).toISOString();
  },
};

globalThis.SessionLib = SessionLib;
