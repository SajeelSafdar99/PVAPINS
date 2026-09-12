/**
 * Version check against the website. Chrome cannot silently replace an unpacked zip.
 */
const UpdateLib = {
  compare(a, b) {
    const left = String(a || "")
      .split(".")
      .map((part) => Number(part) || 0);
    const right = String(b || "")
      .split(".")
      .map((part) => Number(part) || 0);
    const len = Math.max(left.length, right.length);
    for (let i = 0; i < len; i += 1) {
      const x = left[i] || 0;
      const y = right[i] || 0;
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  },

  isOlder(current, latest) {
    return this.compare(current, latest) < 0;
  },

  async check(kind) {
    const current = chrome.runtime.getManifest().version;
    const { apiUrl } = await chrome.storage.local.get("apiUrl");
    const base = String(apiUrl || DEFAULT_API_URL || "").replace(/\/$/, "");
    if (!base) {
      return { current, available: false, skipped: true };
    }

    const origin = `${new URL(base).origin}/*`;
    const have = await chrome.permissions.contains({ origins: [origin] });
    if (!have) {
      return { current, available: false, skipped: true };
    }

    const response = await fetch(`${base}/api/extensions`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Update check failed (${response.status})`);
    }

    const info = data[kind];
    if (!info?.version || !info?.zip) {
      throw new Error("Update info was missing.");
    }

    const update = {
      current,
      latest: info.version,
      zipUrl: info.zip,
      filename: info.filename || `pvapins-${kind}.zip`,
      available: this.isOlder(current, info.version),
      checkedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ extensionUpdate: update });
    return update;
  },

  async download(zipUrl, filename) {
    if (!zipUrl) throw new Error("No update zip URL.");
    await chrome.downloads.download({
      url: zipUrl,
      filename: filename || "pvapins-extension.zip",
      saveAs: true,
    });
    try {
      await chrome.tabs.create({ url: "chrome://extensions" });
    } catch {
      // ignore
    }
  },
};
