// Per-site request matchers + prompt extractors for the StileAI interceptor.
//
// Factored into its own file for one reason: these extractors are the part most
// likely to silently break when ChatGPT / Claude / Gemini change their request
// shapes. Keeping them here lets a regression test (extractors.test.mjs) exercise
// the REAL code against saved sample bodies, so a vendor change fails CI instead
// of a customer's block silently going quiet.
//
// UMD-ish: in the page (MAIN world) it attaches to `self.__StileAIExtractors`;
// under Node/vitest it exports via module.exports. No bundler required.
(function (root, factory) {
  const api = factory();
  if (root) root.__StileAIExtractors = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof self !== "undefined" ? self : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

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

  const SITES = [
    {
      host: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
      label: "ChatGPT",
      // Only the real "send a message" endpoint: POST /backend-api/conversation
      // (or the newer /backend-api/f/conversation), optionally with a query
      // string. Deliberately NOT /conversations (history list), /conversation/{id}
      // (open a chat), or /conversation/requirements (proof-of-work), which fire
      // on page load and carry high-entropy tokens, not user messages.
      matches: (u) => /\/backend-api\/(f\/)?conversation(\?|$)/.test(u),
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
    {
      host: /(^|\.)grok\.com$/,
      label: "Grok",
      // grok.com posts the user turn to its chat API: /rest/app-chat/conversations/new
      // for a fresh chat, or /rest/app-chat/conversations/{id}/responses for a follow-up.
      // The message rides in a top-level "message" field. We key extraction on that
      // field so the sibling POST that only carries {responseIds:[...]} (grok fetching
      // its own answer back) is ignored, no false block, no noise.
      matches: (u) => /\/rest\/app-chat\/conversations\//.test(u),
      extract: (body) => {
        try {
          const j = JSON.parse(body);
          // grok fetches its own answer back with {responseIds:[...]} and no user
          // text. That is not a message; skip it (returning the longest string here
          // would surface a UUID and create audit noise).
          if (j && j.responseIds && !j.message && !j.messages && !j.input) return null;
          // Grok has moved the user turn between fields across versions. Probe the
          // known direct fields first, then the last message in a list, then fall
          // back to the longest string in the payload (which is the user's text).
          for (const k of ["message", "input", "text", "prompt", "query"]) {
            if (typeof j[k] === "string" && j[k].trim()) return j[k];
          }
          if (Array.isArray(j.messages) && j.messages.length) {
            const last = j.messages[j.messages.length - 1];
            if (last) {
              if (typeof last.message === "string" && last.message.trim()) return last.message;
              if (typeof last.content === "string" && last.content.trim()) return last.content;
            }
          }
          const longest = longestString(j);
          if (longest && longest.trim().length >= 2) return longest;
        } catch (_) {}
        return null;
      },
    },
    {
      host: /(^|\.)copilot\.microsoft\.com$/,
      label: "Copilot",
      // Microsoft Copilot's chat API lives under /c/api/conversations/{id}/... The
      // user turn is POSTed there; history is a GET (the interceptor only extracts
      // POSTs, so history is never read). The message is a text run inside a
      // content array: content:[{type:"text",text:"..."}], mirroring the turn shape.
      matches: (u) => /\/c\/api\/conversations\//.test(u),
      extract: (body) => {
        try {
          const j = JSON.parse(body);
          const fromContent = (c) =>
            Array.isArray(c)
              ? c.filter((p) => p && p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n")
              : "";
          if (typeof j.text === "string") return j.text;
          if (typeof j.message === "string") return j.message;
          let t = fromContent(j.content);
          if (t) return t;
          // a turn wrapper, a messages list, or a results list (human turn)
          const turn = Array.isArray(j.messages)
            ? j.messages[j.messages.length - 1]
            : Array.isArray(j.results)
            ? j.results.filter((r) => r && r.author && r.author.type === "human").pop()
            : j.turn || j.message || null;
          if (turn && typeof turn === "object") {
            if (typeof turn.text === "string") return turn.text;
            t = fromContent(turn.content);
            if (t) return t;
          }
        } catch (_) {}
        return null;
      },
    },
  ];

  // Resolve the matching site for a request URL on a given host. In the page world
  // `host` defaults to the live location.hostname; tests pass it explicitly.
  function siteFor(url, host) {
    const h = host != null ? host : (typeof location !== "undefined" ? location.hostname : "");
    for (const s of SITES) if (s.host.test(h) && s.matches(url)) return s;
    return null;
  }

  return { SITES, longestString, siteFor };
});
