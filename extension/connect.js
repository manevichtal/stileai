// StileAI connect receiver, runs only on the dashboard's /extension/connect page.
// That page redeems the user's one-time invite link and posts the seat's key to the
// window; this content script (ISOLATED world, so it can use chrome.*) picks it up
// and stores it, binding this browser to the user's seat + org. No copy-paste.
(function () {
  "use strict";
  window.addEventListener("message", (ev) => {
    // Same-origin only: the key must come from the connect page itself.
    if (ev.source !== window || ev.origin !== window.location.origin) return;
    const d = ev.data;
    if (!d || d.__stileaiConnect !== true || typeof d.key !== "string") return;
    chrome.runtime.sendMessage({
      type: "setKey",
      key: d.key,
      endpoint: typeof d.endpoint === "string" ? d.endpoint : window.location.origin,
    });
  });
})();
