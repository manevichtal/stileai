# StileAI

**The security & compliance checkpoint for agentic AI.**

StileAI sits between a company's AI agents and the systems those agents can act on
(send email, move money, delete records). Before an agent does something sensitive
it asks StileAI; StileAI checks the request against that company's policy rules and
returns **allow / deny / require_approval**, logging every decision to a tamper-aware
audit trail. Admins manage rules and review activity from a web dashboard.

## Architecture

```
AI agent ──(MCP)──▶ Interlock MCP server ──(HTTPS + API key)──▶ Dashboard API ──▶ Supabase
   (interlock-mcp/, on Render)                                  (dashboard/, on Vercel)   (Postgres + Auth)
                                                                        ▲
                                                        Company admin ──┘ (browser login)
```

The **dashboard is the source of truth**: admins edit policies there, the MCP pulls
them (polling a cheap version endpoint), and the MCP pushes audit entries + pending
approvals back. If the dashboard is unreachable the checkpoint **fails safe (deny)** —
it never silently allows.

## Repository layout

| Path | What it is |
|------|-----------|
| `dashboard/` | Next.js (App Router, TypeScript, Tailwind) web app — the admin UI **and** the API the MCP talks to. Deploys to **Vercel**. |
| `interlock-mcp/` | The pre-built, tested MCP policy engine (Python). Runs in `api` store mode against the dashboard. Deploys to **Render**. |
| `supabase/` | Database schema (Postgres + Row Level Security + Supabase Auth). |

## Multi-tenant

Each customer company is one `organization`; admins belong to an org via a `profile`.
Every org-scoped table (policies, audit, approvals, keys) is protected by Row Level
Security, so an admin only ever sees their own org's data. MCP-facing API routes
authenticate by **API key** (not a user session) and resolve the key to exactly one org.

## Local development

```bash
# Dashboard
cd dashboard
cp .env.example .env.local   # fill in your Supabase URL + keys
npm install
npm run dev                  # http://localhost:3000

# MCP engine (api mode, pointed at the dashboard)
cd interlock-mcp
# set INTERLOCK_STORE=api, INTERLOCK_DASHBOARD_URL, INTERLOCK_API_KEY
python -m interlock.server
```

See `dashboard/.env.example` and `interlock-mcp/.env.example` for the full config.

## Environment variables

**Dashboard (Vercel):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (server-side only — never exposed to the browser).

**MCP (Render):** `INTERLOCK_STORE=api`, `INTERLOCK_TRANSPORT=http`,
`INTERLOCK_DASHBOARD_URL`, `INTERLOCK_API_KEY`.

Secrets are never committed — see `.gitignore`.
