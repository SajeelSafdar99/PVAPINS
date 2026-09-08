importScripts("session.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "APPLY_SESSION") return;

  (async () => {
    const { payload, windowId, storeId } = message;
    const cookieResult = await SessionLib.applyCookies(payload.cookies, storeId);
    const auth = await SessionLib.readAuthCookies(storeId);
    const storageResult = await SessionLib.applyStorage(payload.storage, windowId);
    const verify = await SessionLib.verifyAppLogin(windowId);
    return { storeId, cookieResult, auth, storageResult, verify };
  })()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});
