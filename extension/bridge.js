// StileAI bridge, runs in the ISOLATED world so it CAN use chrome.* APIs. It relays
// verdict requests from the page-world interceptor to the background service worker
// (which holds the StileAI key and calls the backend) and posts the answer back.
(function () {
  "use strict";
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d) return;

    if (d.__stileai === "decide") {
      chrome.runtime.sendMessage(
        { type: "decide", prompt: d.prompt, label: d.label },
        (verdict) => {
          // If the worker was asleep / errored, fall back to allow so we never hang the
          // page. (The genuine unreachable-backend fail-closed decision is made in the
          // worker itself, where we can tell "server down" from "extension broken".)
          if (chrome.runtime.lastError || !verdict) {
            verdict = { effect: "allow", reason: "", categories: [] };
          }
          window.postMessage({ __stileai: "verdict", id: d.id, verdict }, "*");
        }
      );
    } else if (d.__stileai === "status") {
      chrome.runtime.sendMessage({ type: "getStatus" }, (status) => {
        if (chrome.runtime.lastError || !status) status = { enabled: false, configured: false };
        window.postMessage({ __stileai: "statusResult", status }, "*");
      });
    } else if (d.__stileai === "extractMiss") {
      // Fire-and-forget health beacon; no reply expected.
      try { chrome.runtime.sendMessage({ type: "beacon", site: d.label }); } catch (_) {}
    }
  });
})();
