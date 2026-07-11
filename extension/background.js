// StileAI background service worker — the only place the org key lives and the only
// place that talks to the StileAI backend. It answers verdict requests from the
// bridge by POSTing the prompt to /api/inspect and returning the decision.
//
// Fail-closed: if StileAI can't be reached and the admin hasn't opted into
// fail-open, a prompt we couldn't verify is BLOCKED (never silently allowed) — the
// same guarantee the server-side proxy makes.
"use strict";

const DEFAULTS = {
  endpoint: "https://stileai.vercel.app",
  key: "",
  enabled: true,
  failClosed: true,
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
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ prompt, site: label, model: label }),
    });
    const v = await r.json();
    if (v && v.effect) return v;
    // Malformed answer → treat as unverifiable.
    throw new Error("bad response");
  } catch (_) {
    return cfg.failClosed
      ? {
          effect: "deny",
          reason:
            "StileAI couldn't verify this message (the policy service was unreachable), so it was blocked to protect company data.",
          categories: [],
          unreachable: true,
        }
      : { effect: "allow", reason: "", categories: [], unreachable: true };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "decide") {
    inspect(msg.prompt, msg.label).then(sendResponse);
    return true; // keep the channel open for the async reply
  }
  if (msg && msg.type === "getStatus") {
    getConfig().then((c) =>
      sendResponse({ enabled: c.enabled, configured: !!c.key, endpoint: c.endpoint, failClosed: c.failClosed })
    );
    return true;
  }
  // The connect page hands us the seat's key after the user redeems their invite
  // link — store it (and the workspace URL) so the extension is bound going forward.
  if (msg && msg.type === "setKey" && msg.key) {
    const patch = { key: msg.key, enabled: true };
    if (msg.endpoint) patch.endpoint = String(msg.endpoint).replace(/\/+$/, "");
    chrome.storage.sync.set(patch).then(() => sendResponse({ ok: true }));
    return true;
  }
});
