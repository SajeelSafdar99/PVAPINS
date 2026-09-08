const statusEl = document.getElementById("status");
const exportBtn = document.getElementById("exportBtn");

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = `status${kind ? ` ${kind}` : ""}`;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

exportBtn.addEventListener("click", async () => {
  exportBtn.disabled = true;
  setStatus("Reading Grammarly cookies…");

  try {
    const payload = await SessionLib.buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    await chrome.downloads.download({
      url,
      filename: `grammarly-session-${stamp()}.json`,
      saveAs: true,
    });

    const lines = [
      `Saved ${payload.summary.count} cookies.`,
      `grauth: ${payload.summary.hasGrauth ? "found" : "MISSING"}`,
      "Upload this file on the admin website when you add or update a user.",
    ];
    setStatus(lines.join("\n"), payload.summary.hasGrauth ? "ok" : "bad");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "bad");
  } finally {
    exportBtn.disabled = false;
  }
});
