// StileAI interceptor — runs in the PAGE (MAIN) world at document_start so it can
// patch window.fetch BEFORE the AI site's own bundle captures a reference to it.
//
// On every outgoing "send message" request to ChatGPT / Claude / Gemini it extracts
// the user's prompt, asks the StileAI backend (via the extension bridge) for a
// verdict, and — if the prompt breaks company policy — blocks the request and shows
// an inline banner. Approved prompts pass straight through, untouched.
//
// It also shows a small status badge so you can SEE it's active and watch it check
// each message — the fastest way to tell setup problems from real blocks.
(function () {
  "use strict";
  if (window.__stileaiInstalled) return;
  window.__stileaiInstalled = true;

  var log = function () {
    try {
      console.debug.apply(console, ["[StileAI]"].concat([].slice.call(arguments)));
    } catch (_) {}
  };
  log("interceptor loaded on", location.hostname);

  // ---- Per-site request matchers + prompt extractors -----------------------
  const SITES = [
    {
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      label: "ChatGPT",
      matches: (u) => /\/backend-api\/.*conversation/.test(u),
      extract: (body) => {
        try {
          const j = JSON.parse(body);
          const msgs = Array.isArray(j.messages) ? j.messages : [];
          const users = msgs.filter((m) => (m.author && m.author.role) === "user");
          const last = users[users.length - 1] || msgs[msgs.length - 1];
          const parts = last && last.content && last.content.parts;
          if (Array.isArray(parts)) return parts.map(String).join("\n");
        } catch (_) {}
        return null;
      },
    },
    {
      host: /(^|\.)claude\.ai$/,
      label: "Claude",
      matches: (u) => /\/completion(\?|$)|\/chat_conversations\/.*\/completion/.test(u),
      extract: (body) => {
        try {
          const j = JSON.parse(body);
          if (typeof j.prompt === "string") return j.prompt;
          if (Array.isArray(j.messages)) {
            const u = j.messages.filter((m) => m.role === "user").pop() || j.messages.pop();
            if (u) return typeof u.content === "string" ? u.content : JSON.stringify(u.content);
          }
        } catch (_) {}
        return null;
      },
    },
    {
      host: /(^|\.)gemini\.google\.com$/,
      label: "Gemini",
      matches: (u) => /StreamGenerate|batchexecute|assistant\.lamda/.test(u),
      extract: (body) => {
        try {
          const params = new URLSearchParams(body);
          const freq = params.get("f.req");
          if (freq) return longestString(JSON.parse(freq));
        } catch (_) {}
        return null;
      },
    },
  ];

  function longestString(node, best) {
    best = best || { v: "" };
    if (typeof node === "string") {
      if (node.length > best.v.length) best.v = node;
    } else if (Array.isArray(node)) {
      for (const n of node) longestString(n, best);
    } else if (node && typeof node === "object") {
      for (const k in node) longestString(node[k], best);
    }
    return best.v;
  }

  function siteFor(url) {
    const host = location.hostname;
    for (const s of SITES) if (s.host.test(host) && s.matches(url)) return s;
    return null;
  }

  // ---- Bridge round-trips (decision + status) ------------------------------
  const pending = new Map();
  let seq = 0;
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d) return;
    if (d.__stileai === "verdict") {
      const resolve = pending.get(d.id);
      if (resolve) {
        pending.delete(d.id);
        resolve(d.verdict);
      }
    } else if (d.__stileai === "statusResult") {
      setBadge(d.status && d.status.configured ? "active" : "nokey");
    }
  });

  function decide(prompt, label) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      window.postMessage({ __stileai: "decide", id, prompt, label }, "*");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ effect: "allow", reason: "", categories: [], timedOut: true });
        }
      }, 8000);
    });
  }

  function requestStatus() {
    window.postMessage({ __stileai: "status" }, "*");
  }

  async function bodyToText(input, init) {
    try {
      if (init && typeof init.body === "string") return init.body;
      if (init && init.body instanceof URLSearchParams) return init.body.toString();
      if (input instanceof Request) return await input.clone().text();
    } catch (_) {}
    return "";
  }

  function methodOf(input, init) {
    const m = (init && init.method) || (input instanceof Request && input.method) || "GET";
    return String(m).toUpperCase();
  }

  function urlOf(input) {
    return typeof input === "string" ? input : (input && input.url) || "";
  }

  function blockedResponse(verdict) {
    return new Response(
      JSON.stringify({ error: { message: "Blocked by StileAI policy: " + (verdict.reason || "") } }),
      { status: 403, statusText: "Blocked by StileAI", headers: { "Content-Type": "application/json" } }
    );
  }

  async function inspectAndMaybeBlock(input, init) {
    const url = urlOf(input);
    const site = siteFor(url);
    if (!site || methodOf(input, init) !== "POST") return null;
    const bodyText = await bodyToText(input, init);
    if (!bodyText) return null;
    const prompt = site.extract(bodyText) || bodyText;
    if (!prompt || !prompt.trim()) return null;
    log("checking", site.label, "message");
    flashBadge("checking");
    const verdict = await decide(prompt, site.label);
    if (verdict && verdict.effect && verdict.effect !== "allow") {
      log("BLOCKED", verdict.effect, verdict.reason);
      flashBadge(verdict.effect === "deny" ? "blocked" : "held");
      showBanner(verdict, site.label);
      return blockedResponse(verdict);
    }
    log("allowed", site.label);
    flashBadge("allowed");
    return null;
  }

  // ---- Patch fetch ---------------------------------------------------------
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      const blocked = await inspectAndMaybeBlock(input, init);
      if (blocked) return blocked;
    } catch (e) {
      log("interceptor error (allowing through):", e);
    }
    return origFetch.apply(this, arguments);
  };

  // ---- Status badge (proof it's active) ------------------------------------
  let badgeEl = null;
  let flashTimer = null;
  const BADGE_STATE = {
    active: { text: "🛡️ StileAI on", bg: "#0f7a3d" },
    nokey: { text: "🛡️ StileAI — add key", bg: "#9a6206" },
    checking: { text: "🛡️ checking…", bg: "#1a56db" },
    allowed: { text: "🛡️ allowed", bg: "#0f7a3d" },
    blocked: { text: "⛔ blocked", bg: "#b02a37" },
    held: { text: "🟠 needs approval", bg: "#b8791a" },
  };

  function ensureBadge() {
    if (badgeEl || !document.body) return;
    badgeEl = document.createElement("div");
    badgeEl.style.cssText =
      "position:fixed;bottom:14px;right:14px;z-index:2147483647;padding:6px 11px;border-radius:999px;" +
      "font:600 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff;" +
      "box-shadow:0 4px 14px rgba(0,0,0,.25);opacity:.92;pointer-events:none;transition:background .2s";
    document.body.appendChild(badgeEl);
    setBadge("checking"); // until status comes back
    requestStatus();
  }

  let baseState = "active";
  function setBadge(state) {
    if (state === "active" || state === "nokey") baseState = state;
    paint(state);
  }
  function flashBadge(state) {
    paint(state);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => paint(baseState), 2500);
  }
  function paint(state) {
    if (!badgeEl) return;
    const s = BADGE_STATE[state] || BADGE_STATE.active;
    badgeEl.textContent = s.text;
    badgeEl.style.background = s.bg;
  }

  if (document.body) ensureBadge();
  else document.addEventListener("DOMContentLoaded", ensureBadge);
  // Re-assert status a moment after load (worker may have been asleep).
  setTimeout(() => {
    ensureBadge();
    requestStatus();
  }, 1500);

  // ---- Inline banner -------------------------------------------------------
  let styleInjected = false;
  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const css = document.createElement("style");
    css.textContent =
      ".stileai-banner{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;" +
      "max-width:520px;width:calc(100% - 32px);border-radius:12px;padding:14px 16px;display:flex;gap:12px;" +
      "align-items:flex-start;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "box-shadow:0 12px 40px rgba(0,0,0,.22);color:#fff;animation:stileai-in .18s ease-out}" +
      "@keyframes stileai-in{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}" +
      ".stileai-deny{background:#b02a37}.stileai-approval{background:#b8791a}" +
      ".stileai-badge{font-weight:700;letter-spacing:.02em}.stileai-body{flex:1}" +
      ".stileai-title{font-weight:600;margin-bottom:2px}.stileai-reason{opacity:.95}" +
      ".stileai-x{cursor:pointer;opacity:.8;font-size:18px;line-height:1;padding:0 2px}.stileai-x:hover{opacity:1}";
    (document.head || document.documentElement).appendChild(css);
  }

  function showBanner(verdict, label) {
    injectStyle();
    ensureBadge();
    const deny = verdict.effect === "deny";
    const el = document.createElement("div");
    el.className = "stileai-banner " + (deny ? "stileai-deny" : "stileai-approval");
    const title = deny
      ? "StileAI blocked this message"
      : "StileAI needs admin approval before this can be sent";
    el.innerHTML =
      '<div class="stileai-badge">🛡️</div>' +
      '<div class="stileai-body"><div class="stileai-title">' +
      title +
      " (" + label + ')</div><div class="stileai-reason"></div></div>' +
      '<div class="stileai-x">×</div>';
    el.querySelector(".stileai-reason").textContent =
      verdict.reason || "This message is restricted by your company's AI policy.";
    el.querySelector(".stileai-x").addEventListener("click", () => el.remove());
    document.body ? document.body.appendChild(el) : document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }
})();
