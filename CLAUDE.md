# CLAUDE.md — Build & deploy instructions for Claude Code

You are Claude Code, working in this repository on the developer's machine. Your
job is to build and deploy **Interlock**, a governance checkpoint product for
agentic AI, using the plan below. Work incrementally, test as you go, commit
often, and **pause for the human at every step that requires logging into an
account** (they will tell you when it's done).

The person you're working with does not code. Explain what you're doing in plain
language, keep them oriented, and never assume they'll edit files by hand — you
do the editing.

---

## 1. What Interlock is

Interlock sits between a company's AI agents and the systems those agents can act
on (send email, move money, delete records). Before an agent does something
sensitive it asks Interlock; Interlock checks the request against that company's
policy rules and returns **allow / deny / require_approval**, logging every
decision. A company admin manages the rules and reviews activity from a **web
dashboard**. The product is sold to companies to run as their AI governance +
audit layer.

## 2. What already exists (DO NOT rewrite from scratch)

The `interlock-mcp/` folder is a **finished, tested** MCP server — the decision
engine, audit redaction, approval workflow, fail-safe behaviour, and a pluggable
"store" layer are done. Read these before building:

- `interlock-mcp/README.md` — overview and how it runs.
- `interlock-mcp/DASHBOARD_API.md` — **the API contract the dashboard MUST expose.
  This is your source of truth for the dashboard's endpoints.**
- `interlock-mcp/interlock/engine.py` — the policy engine (leave its semantics intact).
- `interlock-mcp/interlock/stores.py` — the `api` store already calls the dashboard;
  your dashboard must match those calls.

Verify it still works before building anything else:
```bash
cd interlock-mcp
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python selftest.py          # expect: ALL CHECKS PASSED
python test_api_store.py    # expect: API STORE: ALL CHECKS PASSED
cd ..
```

## 3. What you are building

Two new things plus deployment:

1. **The dashboard** (`dashboard/`) — a Next.js web app deployed to **Vercel**.
   It is BOTH the admin UI and the API the MCP talks to.
2. **The database + auth** — a **Supabase** project. Schema is in
   `supabase/schema.sql`. Supabase Auth handles admin logins.
3. **Deployment** — dashboard → Vercel, database/auth → Supabase, and the
   existing MCP server → an always-on host (**Render** for free testing; note its
   free tier sleeps after 15 min idle, so recommend a paid always-on tier before
   real customer use). All code lives in one **GitHub** repo.

### Architecture

```
AI agent ──(MCP)──> Interlock MCP server ──(HTTPS + API key)──> Dashboard API (Vercel) ──> Supabase (Postgres + Auth)
  (interlock-mcp/, on Render)                                    (dashboard/, source of truth)     ▲
                                                                                                   │
                                                              Company admin ──(browser login)──────┘
```

The dashboard is the **source of truth**: admins edit policies there, the MCP
pulls them, and the MCP pushes audit entries + pending approvals back.

## 4. Tech stack (use these exact choices)

- **Dashboard:** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- **DB + Auth:** Supabase (Postgres, Row Level Security, Supabase Auth).
- **MCP host:** Render (free web service to start) running `interlock-mcp` with
  `INTERLOCK_STORE=api` and `INTERLOCK_TRANSPORT=http`.
- **Repo:** one GitHub repo containing `interlock-mcp/`, `dashboard/`, `supabase/`.

## 5. Multi-tenant model (important — this is a product sold to many companies)

- Each customer company = one **organization** row.
- Admins belong to an organization (via a `profiles` row linked to Supabase Auth).
- Each organization has one or more **API keys**; the MCP authenticates with a
  key, which resolves to exactly one `org_id`. All data (policies, audit,
  approvals) is scoped by `org_id`.
- **Row Level Security** ensures an admin only ever sees their own org's data.
- The dashboard's MCP-facing API routes authenticate by **API key** (not a user
  session) and use the Supabase **service role** server-side only, always
  filtering by the `org_id` that the key maps to.

## 6. Dashboard API routes (MUST match `interlock-mcp/DASHBOARD_API.md`)

Implement these as Next.js Route Handlers under `dashboard/app/api/`. Authenticate
each by the `Authorization: Bearer <api_key>` header, resolve `org_id`, then
read/write Supabase scoped to that org.

```
GET  /api/policies                     -> { default_effect, default_reason, policies:[...] }
GET  /api/policies/version             -> { version }              (cheap; used for polling)
POST /api/audit                        <- one decision entry
GET  /api/audit?limit=&actor=&effect=  -> [ entries ]
POST /api/approvals                    <- register a pending decision
GET  /api/approvals?status=pending     -> [ pending ]
GET  /api/approvals/{decision_id}      -> pending object
POST /api/approvals/{decision_id}/resolve <- { approver, approved, note }
```

Match the exact JSON shapes in `DASHBOARD_API.md`. The policies payload must be
what `interlock-mcp/interlock/engine.py:load_policies_from_dict` consumes.

## 7. Dashboard UI (admin-facing pages)

Behind Supabase Auth login (email + password to start; design so SSO can be added
later). Keep it clean and simple; this is a security product, so favour clarity.

- **Login / sign-up** (Supabase Auth). On first sign-up, create an organization
  and make the user its admin.
- **Policies** — list rules in evaluation order; create / edit / delete / reorder;
  fields: effect, priority, actor, action, resource, conditions, approvals_required,
  description, enabled. Editing here is what admins came for — make it friendly
  (plain-language helper text, not raw YAML). Saving bumps the org's policy version.
- **Audit log** — searchable table of decisions (filter by actor / effect / date).
- **Approvals** — queue of pending decisions with Approve / Reject buttons and a
  note field; resolving updates status.
- **API keys** — generate / revoke keys the MCP uses; show the key once on
  creation, store only a hash.
- **Settings** — org name, and a copy-paste snippet showing how to point the MCP
  at this dashboard (URL + key + env vars).

## 8. Environment variables

Dashboard (Vercel):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-side only; NEVER exposed to the browser
```
MCP server (Render) — point at the deployed dashboard:
```
INTERLOCK_STORE=api
INTERLOCK_TRANSPORT=http
INTERLOCK_DASHBOARD_URL=https://<your-dashboard>.vercel.app
INTERLOCK_API_KEY=<key generated in the dashboard>
```
(See `interlock-mcp/.env.example` for the full MCP list.)

## 9. Build plan (do in order; commit after each phase)

- **Phase 0 — Verify.** Run the two MCP self-tests above. Confirm green.
- **Phase 1 — Supabase.** The human creates a free Supabase project (browser).
  Then apply `supabase/schema.sql` (via the Supabase SQL editor or `supabase db
  push`). Confirm tables + RLS exist.
- **Phase 2 — Dashboard skeleton.** Scaffold the Next.js app in `dashboard/`,
  wire Supabase Auth, get login + an empty authenticated home page working
  locally (`npm run dev`).
- **Phase 3 — API routes.** Implement Section 6 exactly. Test each route locally
  with `curl` using a test API key against the local dashboard.
- **Phase 4 — Prove the loop.** Run the MCP locally in `api` mode pointed at the
  local dashboard; make a `request_action` and confirm the decision appears in
  Supabase and (later) the audit UI. This is the critical integration moment.
- **Phase 5 — Admin UI.** Build the pages in Section 7 on top of the API.
- **Phase 6 — GitHub.** Initialize the repo and push (human authorizes GitHub).
- **Phase 7 — Deploy dashboard.** Deploy `dashboard/` to Vercel, set env vars
  (human logs into Vercel). Confirm the live URL works.
- **Phase 8 — Deploy MCP.** Deploy `interlock-mcp/` to Render as an HTTP service,
  set env vars to the live Vercel URL + a real API key (human logs into Render).
- **Phase 9 — End-to-end.** Repeat the Phase 4 test against the *live* stack:
  edit a policy in the dashboard, confirm the MCP reflects it within the poll
  interval, and that audit + approvals show up. Hand the human a short "how to
  use it" summary.

## 10. Human-in-the-loop checkpoints (STOP and ask)

Pause and give clear instructions (then wait) at each of these — you can run the
commands, but the human must complete the login/authorization in their browser:
- Creating the Supabase project and getting its keys.
- Authorizing GitHub (`gh auth login` or the browser push).
- Logging into Vercel and confirming the deploy.
- Logging into Render and confirming the deploy.
Never enter passwords, accept terms, or complete OAuth on their behalf.

## 11. Guardrails (non-negotiable)

- **Never fail open.** If the dashboard is unreachable the MCP must not "allow" —
  the existing code already denies; don't weaken it.
- **Protect the service role key.** It is server-side only. Never ship it to the
  browser or commit it. Use `.env.local` locally and Vercel/Render secrets in prod.
- **Hash API keys** at rest; show a key in full only once at creation.
- **Keep RLS on** for all org-scoped tables. Test that one org cannot read another's rows.
- **Preserve redaction** of sensitive params (the MCP already redacts; the
  dashboard must not log raw secrets either).
- Commit small, message clearly, and keep secrets out of git (`.gitignore`).

## 12. Definition of done

1. An admin can sign up, land in their own org, and log in again.
2. Admin edits a policy; the live MCP's next decision reflects it within the poll
   interval, no restart.
3. Every `request_action` appears in the dashboard audit log (secrets redacted).
4. A `require_approval` decision appears in the approvals queue and can be
   approved/rejected there; the agent sees the result via `check_status`.
5. With the dashboard unreachable, the MCP denies rather than allows.
6. Everything runs on the deployed stack (Vercel + Supabase + Render), code in GitHub.
