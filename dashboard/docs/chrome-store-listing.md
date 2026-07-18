# Chrome Web Store listing package

Everything you paste into the Chrome Web Store Developer Dashboard to publish the
StileAI extension. The permission and data sections are the part Google scrutinizes
for an extension that reads page content, so they are written to be accurate and to
pass review. Copy each block into the matching field.

Prerequisites: a Chrome Web Store developer account (one-time $5 fee), and the
extension zip (I provide this, version-bumped each time). Privacy policy is live at
https://stileai.com/privacy.

---

## 1. Store listing

**Item name** (from the manifest; keep or I can change it)
StileAI: AI policy checkpoint

**Summary** (short description, max 132 characters)
Check every prompt your team sends to ChatGPT, Claude, and Gemini against your company policy, and stop leaks before they leave.

**Category**
Workflow & Planning
(There is no dedicated Security category. Workflow & Planning fits a business governance tool. Developer Tools is the alternative if you prefer.)

**Language**
English

**Detailed description**
```
StileAI is a security checkpoint for the AI tools your team already uses. It checks
what employees send to ChatGPT, Claude, and Gemini against your company's policy,
and stops secrets, customer data, and source code before they ever leave the browser.

WHAT IT DOES
Before a message is sent to a supported AI site, StileAI inspects it and returns one
of three outcomes:
- Allow: safe and in policy, sent through with no friction.
- Ask an admin: sensitive, held for an administrator to approve first.
- Block: against policy, stopped before it leaves the browser, with a clear notice.

WHAT IT CATCHES
Passwords and API keys, personal data (PII), customer and client records, financial
information, legal and contract text, health information, and source code. You choose
what happens to each category, and you can add your own words to watch for.

BUILT FOR TRUST
- Sensitive values are masked before anything is logged, so restricted content is
  never stored.
- If StileAI cannot reach the backend, it fails closed rather than letting data
  through.
- Every decision is recorded in an audit trail for compliance.

REQUIRES A STILEAI ACCOUNT
This extension works with your organization's StileAI workspace. An administrator
sets the policy in the StileAI dashboard and invites team members, who connect the
extension with a one-time link. Without a workspace and key, the extension does not
govern anything. Learn more at https://stileai.com.
```

---

## 2. Single purpose (required field)

```
StileAI checks the messages a user sends on supported AI websites (ChatGPT, Claude,
and Gemini) against their organization's data policy, and blocks or holds any that
contain restricted content before it leaves the browser.
```

---

## 3. Permission justifications (required for each)

**storage**
```
Stores the organization's connection settings locally: the workspace URL, the
employee's StileAI key, and a cached fallback preference. These are needed to
authenticate policy checks with the organization's own backend. No browsing history
or page data is stored.
```

**Host permission: the supported AI sites (chatgpt.com, chat.openai.com, claude.ai, gemini.google.com)**
```
The extension's single purpose is to check outgoing messages on these AI sites
against the organization's policy before they are sent. It runs a content script on
these specific sites to read the message the user is about to submit and request an
allow, hold, or block decision. It does not run on any site outside this list.
```

**Host permission: stileai.com, www.stileai.com, stileai.vercel.app (and localhost for development)**
```
The extension communicates only with the organization's own StileAI backend to
obtain a policy decision for each message, and reads a one-time key on the StileAI
connect page to link the extension to the user's workspace. localhost is used only
during development.
```

**Remote code**
```
No. All extension logic is contained in the package. The extension does not load or
execute any remote or externally hosted code.
```

---

## 4. Privacy practices (data usage tab)

**What user data does the extension handle?**
- Website content: the text of the message a user submits on a supported AI site is
  sent to the organization's StileAI backend to be evaluated against policy.
- Authentication information: the employee's StileAI key is stored locally to
  authenticate those checks.

**Disclosures to certify (check these):**
- We do NOT sell user data to third parties.
- We do NOT use or transfer user data for purposes unrelated to the single purpose.
- We do NOT use or transfer user data to determine creditworthiness or for lending.

**Note to include (data handling summary):**
```
Message content is used only to produce a policy decision for the user's own
organization. Sensitive values are masked before any audit record is written, and
the content of blocked or held messages is never stored.
```

**Privacy policy URL**
https://stileai.com/privacy

---

## 5. Graphics

**Store icon:** 128x128 (already in the package: icons/icon-128.png).

**Screenshots** (1280x800 or 640x400, PNG or JPEG, 1 to 5). Shot list, best first:
1. A blocked message on ChatGPT: the red "StileAI blocked this message" banner over
   the chat box, catching a secret. This is the money shot, it shows the product
   working where the user is.
2. The Protection page in the dashboard: the category grid with Allow / Ask an admin
   / Block, and the "what your team will experience" preview.
3. The audit log: a table of decisions with sensitive values masked.
4. The extension active: the "StileAI on" badge on an AI site, or the popup.
5. The approvals queue: a held request with Approve / Reject.

**Small promo tile (optional but recommended):** 440x280, the shield + "StileAI" and
the tagline "Stop AI data leaks before they leave."

---

## 6. Review gotchas to avoid (why security extensions get rejected)

- Be explicit that the extension reads message content and why (done above). Reviewers
  reject vague justifications.
- Do not request host permissions beyond the four AI sites plus your own backend
  (the manifest is already scoped this way, good).
- Keep the single purpose narrow and consistent across every field.
- The description must state it requires a StileAI account, so reviewers understand
  why it needs a key and a backend.
- MV3 with no remote code (already true) is required.

First review can take a few days. Update reviews are usually faster.
