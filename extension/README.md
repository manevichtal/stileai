# StileAI browser extension

Extends StileAI's policy checkpoint to the AI **websites** your team uses in the
browser — **ChatGPT, Claude, and Gemini** — which the API gateway can't reach
(those apps lock their network connection). It reads each prompt *before it's sent*,
checks it against your company's policy using the **same engine and dashboard** as
the rest of StileAI, and blocks or holds anything restricted (secrets, PII, PHI,
customer data, source code, …). Every decision lands in your StileAI audit log.

## How it works

```
You type in ChatGPT/Claude/Gemini
   └─ interceptor (page world) grabs the prompt before it's sent
        └─ background worker → POST https://<your-workspace>/api/inspect  (Bearer <key>)
             └─ StileAI engine: resolveCaller → seat/subscription gate → policy check → audit
        ← { effect: allow | deny | require_approval, reason }
   allow → the message sends normally
   deny / require_approval → the send is blocked and an inline banner explains why
```

- **Approved prompts pass through untouched.** No latency beyond one quick check.
- **No prompt content is stored** — the backend redacts before writing audit rows.
- **Fail-closed by default**: if StileAI can't be reached, an unverifiable prompt is
  blocked (toggleable in the popup).

## How a user gets connected (the normal flow)

1. An **admin invites the user** from the StileAI dashboard → *Team & seats* → enter
   name + work email → **Invite user**. This consumes one seat (billing is per user)
   and produces a **one-time connect link**.
2. The user **installs the extension** (see below), then **opens the connect link**.
3. The connect page redeems the link and hands the seat's key to the extension
   automatically — the browser is now bound to that user's seat + org. Done.

Everything after that (which policies apply, approvals, audit) resolves from the key
to that user and their org — no configuration by the employee.

## Install (unpacked, for testing / pilots)

1. Open `chrome://extensions` in Chrome or Edge.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Open the **connect link** your admin sent → the popup should show connected. (Or,
   as a fallback, click the icon → paste the key from the connect page → **Save**.)

For an org rollout, publish to the Chrome Web Store (a one-time $5 developer account)
so employees install with one click and are managed centrally.

## Configuration (popup)

| Field | Meaning |
|-------|---------|
| **Your StileAI key** | Links this browser to your workspace + seat. |
| **Workspace URL** | Your StileAI deployment (default `https://stileai.com`). |
| **Protection on** | Master on/off. |
| **Block if StileAI is unreachable** | Fail-closed (recommended) vs. fail-open. |

> If you self-host StileAI on a different domain, add that domain to
> `host_permissions` in `manifest.json` before loading the extension.

## Coverage & limitations (v0.1)

- **Covers:** chatgpt.com / chat.openai.com, claude.ai, gemini.google.com — the new
  user turn on each, sent via `fetch`.
- **Interception is at the network `fetch` layer** (hard to bypass casually) and
  matches each site's send endpoint. If a site changes its request format, prompt
  extraction may need an update — until then the extension inspects the raw request
  body rather than letting it through unchecked.
- **Not yet covered:** GitHub Copilot and the native ChatGPT desktop app (they don't
  run in a normal web page). Other browsers, and prompts sent via `XMLHttpRequest`
  rather than `fetch`, are on the roadmap.
- This is a **v0.1 pilot build** — intended for design partners, not yet hardened for
  a determined insider trying to exfiltrate data. It raises the floor dramatically
  over "nothing," which is what most teams have today.
