// StileAI interceptor — runs in the PAGE (MAIN) world at document_start so it can
// patch window.fetch BEFORE the AI site's own bundle captures a reference to it.
//
// On every outgoing "send message" request to ChatGPT / Claude / Gemini it extracts
// the user's prompt, asks the StileAI backend (via the extension bridge) for a
// verdict, and — if the prompt breaks company policy — blocks the request and shows
// an inline banner. Approved prompts pass straight through, untouched.
//
// It talks to the ISOLATED-world bridge over window.postMessage (MAIN-world scripts
// can't use chrome.* APIs directly). Detection/decisions all happen server-side.
(function () {
  "use strict";
  if (window.__stileaiInstalled) return;
  window.__stileaiInstalled = true;

  // ---- Per-site request matchers + prompt extractors -----------------------
  // Each site sends the new user turn as a POST to a known endpoint. We match the
  // URL, then pull the user's text out of the request body. If a site changes its
  // format the structured extractor may miss it — we then fall back to scanning the
  // raw body so detection still runs (fail toward inspecting, never toward leaking).
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
      // Gemini wraps the prompt in a deeply-nested f.req array; best-effort deep scan.
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

  // ---- Bridge round-trip: ask the backend for a verdict --------------------
  const pending = new Map();
  let seq = 0;
  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__stileai !== "verdict") return;
    const resolve = pending.get(d.id);
    if (resolve) {
      pending.delete(d.id);
      resolve(d.verdict);
    }
  });

  function decide(prompt, label) {
    return new Promise((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      window.postMessage({ __stileai: "decide", id, prompt, label }, "*");
      // Safety timeout: if the bridge never answers, don't hang the user's send.
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ effect: "allow", reason: "", categories: [], timedOut: true });
        }
      }, 8000);
    });
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

  // A synthetic response returned in place of a blocked request. The site shows an
  // error for this turn; our banner explains why. No data reached the model.
  function blockedResponse(verdict) {
    return new Response(
      JSON.stringify({ error: { message: "Blocked by StileAI policy: " + (verdict.reason || "") } }),
      { status: 403, statusText: "Blocked by StileAI", headers: { "Content-Type": "application/json" } }
    );
  }

  // ---- Patch fetch ---------------------------------------------------------
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      const url = urlOf(input);
      const site = siteFor(url);
      if (site && methodOf(input, init) === "POST") {
        const bodyText = await bodyToText(input, init);
        if (bodyText) {
          const prompt = site.extract(bodyText) || bodyText;
          if (prompt && prompt.trim()) {
            const verdict = await decide(prompt, site.label);
            if (verdict && verdict.effect && verdict.effect !== "allow") {
              showBanner(verdict, site.label);
              return blockedResponse(verdict);
            }
          }
        }
      }
    } catch (_) {
      // Never let an interceptor bug break the user's AI tool: fall through to the
      // real fetch. (Unreachable-backend fail-closed is handled in the background.)
    }
    return origFetch.apply(this, arguments);
  };

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
      ' (' + label + ')</div><div class="stileai-reason"></div></div>' +
      '<div class="stileai-x">×</div>';
    el.querySelector(".stileai-reason").textContent = verdict.reason || "This message is restricted by your company's AI policy.";
    el.querySelector(".stileai-x").addEventListener("click", () => el.remove());
    document.body ? document.body.appendChild(el) : document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 9000);
  }
})();
