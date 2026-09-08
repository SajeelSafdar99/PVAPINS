/**
 * Shared Grammarly web-session helpers.
 * Used by both capture and apply extensions.
 */
const SessionLib = {
  SESSION_VERSION: 1,

  AUTH_COOKIE_HINTS: ["grauth", "csrf-token", "gnar_containerId"],

  isGrammarlyDomain(domain) {
    return /(^|\.)grammarly\.com$/i.test(String(domain || "").replace(/^\./, ""));
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

  async collectCookies() {
    const all = await chrome.cookies.getAll({});
    return all.filter((cookie) => this.isGrammarlyDomain(cookie.domain));
  },

  summarizeCookies(cookies) {
    const names = new Set(cookies.map((cookie) => cookie.name));
    return {
      count: cookies.length,
      hasGrauth: names.has("grauth"),
      hasCsrf: names.has("csrf-token"),
      names: [...names].sort(),
    };
  },

  async collectPageStorage() {
    const tabs = await chrome.tabs.query({ url: "*://*.grammarly.com/*" });
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

  async buildPayload() {
    const cookies = await this.collectCookies();
    const storage = await this.collectPageStorage();
    return {
      version: this.SESSION_VERSION,
      exportedAt: new Date().toISOString(),
      source: "grammarly-web",
      cookies,
      storage,
      summary: this.summarizeCookies(cookies),
    };
  },

  cookieUrl(cookie) {
    const host = String(cookie.domain || "").replace(/^\./, "");
    const path = cookie.path || "/";
    const scheme = cookie.secure || cookie.sameSite === "no_restriction" ? "https" : "http";
    const urlHost = host === "grammarly.com" ? "app.grammarly.com" : host;
    return `${scheme}://${urlHost}${path}`;
  },

  toSetDetails(cookie, storeId) {
    const details = {
      url: this.cookieUrl(cookie),
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

  async applyCookies(cookies, storeId) {
    const results = { set: 0, failed: [] };
    for (const cookie of cookies) {
      if (!this.isGrammarlyDomain(cookie.domain)) continue;
      if (!cookie.session && cookie.expirationDate && cookie.expirationDate * 1000 < Date.now()) {
        results.failed.push({ name: cookie.name, error: "expired" });
        continue;
      }
      try {
        const written = await chrome.cookies.set(this.toSetDetails(cookie, storeId));
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

  async readAuthCookies(storeId) {
    const query = { url: "https://app.grammarly.com/" };
    if (storeId) query.storeId = storeId;
    const names = ["grauth", "csrf-token", "gac", "tdi"];
    const found = {};
    for (const name of names) {
      const cookie = await chrome.cookies.get({ ...query, name });
      found[name] = Boolean(cookie);
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

  async verifyAppLogin(windowId) {
    const tab = await chrome.tabs.create({
      url: "https://app.grammarly.com/",
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
      if (/signin|signup|\/login/i.test(url)) {
        return { ok: false, url, note: "Redirected to a sign-in page." };
      }

      if (/app\.grammarly\.com/i.test(url)) {
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
          return { ok: true, url: result.href, note: "App opened without a sign-in redirect." };
        } catch {
          return { ok: null, url, note: "App opened. Confirm in the tab whether you are logged in." };
        }
      }
    }

    const current = await chrome.tabs.get(tab.id);
    return {
      ok: null,
      url: current.url || "",
      note: "Timed out waiting for Grammarly. Check the opened tab.",
    };
  },

  parsePayload(raw) {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!data || !Array.isArray(data.cookies)) {
      throw new Error("Invalid session file: missing cookies array.");
    }
    return data;
  },
};

globalThis.SessionLib = SessionLib;
