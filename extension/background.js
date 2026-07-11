// StileAI background service worker, the only place the org key lives and the only
// place that talks to the StileAI backend. It answers verdict requests from the
// bridge by POSTing the prompt to /api/inspect and returning the decision.
//
// Resilience: when the backend is reachable it decides (full engine + the org's
// policies + the AI second opinion). When it is UNREACHABLE, the extension does not
// go dark: it runs a local copy of the deterministic checks on-device (detectors.js)
// and blocks anything it can detect, allowing clean prompts through in a "degraded"
// state. Orgs that prefer maximum safety can choose "hold" (block everything when
// unreachable) from the dashboard; that choice is cached here from server responses.
"use strict";

importScripts("detectors.js"); // provides self.StileAIDetect(prompt)

const DEFAULTS = {
  endpoint: "https://stileai.com",
  key: "",
  enabled: true,
  // The org's outage policy, cached from /api/inspect responses:
  //   "availability" (default) / "flag" → run the on-device checks when unreachable
  //   "hold" → block everything when unreachable (maximum safety)
  fallback: "availability",
};

async function getConfig() {
  const s = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...s };
}

async function inspect(prompt, label) {
  const cfg = await getConfig();

  // Extension turned off, or not linked to a workspace yet → don't govern. An
  // unconfigured extension must not brick everyone's AI; the admin links a key first.
  if (!cfg.enabled) return { effect: "allow", reason: "", categories: [] };
  if (!cfg.key) return { effect: "allow", reason: "", categories: [], unconfigured: true };

  const url = cfg.endpoint.replace(/\/+$/, "") + "/api/inspect";
  // Bound the check so a slow/hung backend resolves to our fail-closed path
  // BEFORE the page-side 8s safety timeout can fail open. 6s < 8s guarantees the
  // deliberate decision (deny when unverifiable) wins.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ prompt, site: label, model: label }),
      signal: ctrl.signal,
    });
    const v = await r.json();
    if (v && v.effect) {
      // Cache the org's outage policy for the next time we can't reach the backend.
      if (v.fallback && v.fallback !== cfg.fallback) {
        chrome.storage.sync.set({ fallback: v.fallback });
      }
      return v;
    }
    // Malformed answer → treat as unreachable.
    throw new Error("bad response");
  } catch (_) {
    return offlineVerdict(prompt, cfg);
  } finally {
    clearTimeout(timer);
  }
}

// The backend was unreachable. Degrade the way the admin chose.
function offlineVerdict(prompt, cfg) {
  if (cfg.fallback === "hold") {
    return {
      effect: "deny",
      reason:
        "StileAI is temporarily unreachable and your organization holds unverified requests, so this was blocked to protect company data.",
      categories: [],
      unreachable: true,
    };
  }
  // Run the on-device checks: block what we can detect locally, allow clean prompts.
  try {
    const local = self.StileAIDetect ? self.StileAIDetect(prompt) : { categories: [], reason: "" };
    if (local.categories && local.categories.length) {
      return { effect: "deny", reason: local.reason, categories: local.categories, unreachable: true, degraded: true };
    }
  } catch (_) {}
  return { effect: "allow", reason: "", categories: [], unreachable: true, degraded: true };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "decide") {
    inspect(msg.prompt, msg.label).then(sendResponse);
    return true; // keep the channel open for the async reply
  }
  if (msg && msg.type === "getStatus") {
    getConfig().then((c) =>
      sendResponse({ enabled: c.enabled, configured: !!c.key, endpoint: c.endpoint, fallback: c.fallback })
    );
    return true;
  }
  // The connect page hands us the seat's key after the user redeems their invite
  // link, store it (and the workspace URL) so the extension is bound going forward.
  if (msg && msg.type === "setKey" && msg.key) {
    const patch = { key: msg.key, enabled: true };
    if (msg.endpoint) patch.endpoint = String(msg.endpoint).replace(/\/+$/, "");
    chrome.storage.sync.set(patch).then(() => sendResponse({ ok: true }));
    return true;
  }
});
