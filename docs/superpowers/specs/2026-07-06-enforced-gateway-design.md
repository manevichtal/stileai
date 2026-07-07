# StileAI Enforced Gateway — Design Spec

_Date: 2026-07-06 · Status: approved design, pre-implementation_

## 1. Goal

Make StileAI govern an AI agent's actions **transparently and unbypassably**. Today
the agent must explicitly call a `request_action` tool ("Using StileAI…"), which no
real user will do. The enforced gateway removes that: the agent uses its **normal
tools**, every tool call **physically passes through StileAI**, and StileAI decides
**allow / deny / hold** before the real action runs. The user prompts as they do
today; StileAI is invisible and in the background.

The result must be a **real, sellable product** — usable with a customer's own tools
and their own policies — not a demo limited to fixed actions.

## 2. Architecture

StileAI becomes a **gateway (MCP proxy)** between the agent and its tools.

```
   Claude / Cursor / any MCP agent
              │  one URL:  https://<checkpoint>/gw?key=<token>
        ┌─────▼──────────────┐
        │  StileAI Gateway   │  ← inspects every tool call: allow / deny / hold
        └─────┬──────────────┘        ▲ policies · audit · approvals  (existing engine, reused)
     ┌────────┼─────────┬───────────┐
   Email    Database  Payments   …any MCP tool server   (the customer's real tools)
```

- The agent connects to **one gateway URL** (the paste-one-URL `?key=` flow already
  built). The gateway is a mode of the existing checkpoint service (`interlock-mcp`),
  so it reuses auth, the engine, and the stores.
- Behind the gateway, the org registers its real tools ("Connected tools"). The
  gateway connects to each as an MCP client, **aggregates their tools**, and
  **re-exposes them to the agent** as if they were its own.
- On every tool call from the agent, the gateway runs the policy engine, then
  allow → forward, deny → refuse, hold → approval.

**Why this model** (decided during brainstorming): it matches how agents already
reach tools (MCP), is invisible + unbypassable, covers "everything" the agent
touches, sees the real action with full detail, and reuses the entire decision brain.
A network-traffic proxy was rejected: it can't see inside encrypted app/API calls and
is brittle infra.

## 3. Components

**Reused as-is (the brain):** decision engine (`interlock/engine.py`), policies,
audit log, approvals, dashboard, and the `?key=` / bearer auth.

**New:**

1. **Gateway proxy** (in `interlock-mcp`). A streamable-HTTP MCP surface at `/gw`
   (auth via `?key=` or `Authorization` header, same token as the checkpoint). On
   startup it loads the org's connected tools, connects to each downstream MCP
   server as a client, lists their tools, and registers a gating wrapper for each.
   On a wrapped tool call it evaluates policy and then forwards / refuses / holds.
   Downstream servers may be `stdio` (command) or `http` (URL). Tool-name collisions
   across servers are namespaced (`<server>__<tool>`).

2. **Connected-tools config.** A new `connected_tools` table (per org): `name`,
   `transport` (stdio|http), `target` (URL or command+args), `auth` (encrypted),
   `enabled`. A dashboard **"Connected tools"** page (CRUD). A `GET /api/tools`
   endpoint (API-key auth) the gateway pulls on startup and re-polls for changes
   (same pattern as `/api/policies` + version).

3. **Detailed approval view.** The Approvals page shows, per held call, everything a
   human needs: agent/actor, the exact downstream tool + action, **every parameter
   (secrets redacted)**, the resource, the matched policy + reason, and timestamp.

4. **Sample tools server** (bundled, for demos/sales). A tiny MCP server exposing
   realistic risky tools — `send_email`, `charge_card`, `delete_records`,
   `read_data` — so anyone can demo the gateway blocking a real agent in two minutes
   without wiring real tools. It is a demo prop only; the gateway itself is generic.

## 4. Policy evaluation

Each intercepted call is evaluated by the existing engine as an action:

- `actor` — the agent identity (a per-gateway configured value, default
  `agent:default`).
- `action` — the tool's name (e.g. `charge_card`); glob patterns supported
  (`db.*`, `*`).
- `resource` — derived from args when available, else `*`.
- `params` — the tool's arguments (inspected by policy `conditions`, e.g.
  `amount > 100`).

Admins write policies against their tools' names/args on the existing Policies page
and compliance library. No new policy language.

## 5. Approval behavior

Rules carry a **hold mode** (`wait` | `queue`); default `wait`.

- **wait (ship first):** the agent's tool call is **paused**. The gateway records a
  pending approval and polls the dashboard until resolved or timeout.
  - **Approve →** the gateway **runs the real tool and returns its result to the
    agent, which continues automatically** — the task just completes for the user.
  - **Deny →** the real tool never runs; the gateway returns a "not permitted"
    result; the agent tells the user it couldn't do that and moves on.
  - **Timeout →** deny (fail-safe).
- **queue (fast-follow):** the gateway immediately returns "needs approval (id)"; the
  agent isn't paused. On later approval the action runs and the outcome is
  logged/notified (not fed back into the finished conversation). Deferred because it
  needs extra "re-run the held call later" machinery.

Every call — allowed, denied, or held — is written to the audit trail (redacted).

## 6. Security requirements

Core (gateway):

- **Fail-safe:** unreachable control plane → **deny**, never allow (existing engine).
- **Unbypassable:** tools are reachable only through the gateway. Deployment guidance:
  do not also expose the raw tools directly to the agent. Enforcement is real, not
  advisory — a jailbroken agent still cannot exceed policy.
- **Data residency:** self-host keeps tool payloads in the customer's environment
  (best for regulated buyers); a hosted option exists but transits StileAI. Lead with
  self-host for sensitive tools.
- **Redaction:** sensitive params stripped before audit **and** before display in the
  detailed approval view.

Hardenings adopted from the security review (kept only what fits our stack — Next.js
API routes + Supabase, tenant = org; NXSCRM-specific items excluded):

- **Fail closed on the auth token.** In HTTP transport the gateway/checkpoint MUST
  require `INTERLOCK_MCP_AUTH_TOKEN` and refuse to start if it's missing — never run
  an open endpoint. Generalize: a missing security-relevant env var is a hard failure,
  not a silent skip.
- **Connect URL key is a secret.** The `?key=` grants access; treat like a password,
  support rotation, offer a header-only (no-key-in-URL) option, and **never log the
  key** — suppress query strings/tokens in checkpoint logs.
- **Tenant isolation from identity only.** `org_id` is always derived from the
  authenticated identity (user session → profile, or API-key → org), never from a
  request body; if a body carries `org_id`, verify it matches or return 403. Every
  tenant table has a real `org_id = current_org_id()` RLS policy (never `USING(true)`);
  `org_id` stays `uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.
- **Admin-only tables check role AND org.** `api_keys`, `org_policy_settings`, and the
  new `connected_tools` require `role = 'admin'`, not just org membership. Add
  `CHECK (role IN ('admin','approver','viewer'))` to `profiles`.
- **Downstream tool credentials encrypted at rest**, enforced by a DB `CHECK`
  (e.g. `auth LIKE 'enc:%'`), and kept in the self-hosted gateway where possible. Any
  generated tokens use a server-side crypto RNG.
- **Audit trail is append-only.** Only the service role (the checkpoint/gateway) may
  INSERT `audit_log`; tenants are **read-only** (revoke UPDATE/DELETE). Audit-write
  failures are **logged and retried**, never silently swallowed — the gateway's audit
  row is the compliance record of what the agent did.
- **Error hygiene.** API responses return a generic error + a request id; the real
  error is logged server-side only. Never leak raw DB error strings; never log tokens
  or credentials.
- **Platform-admin from an explicit allowlist** (env `PLATFORM_ADMIN_EMAILS` or a
  dedicated table), never a name/pattern match; the platform-owner area stays
  read-only.
- **`SECURITY DEFINER` hygiene** (for any such function we add): `SET search_path`,
  `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`, and an in-body auth check.
- **Schema discipline.** One source-of-truth definition per object; apply changes as
  ordered migrations; new tenant tables ship **with** RLS and go into the audit path.
- **Verification.** Prove RLS as a real authenticated/anon user via REST (not Studio,
  which bypasses RLS); assert actual row counts, not just a 2xx/204.

Not adopted (NXSCRM-specific): Supabase edge functions/Deno, `guard/validate/dbWrite`
helpers, Stripe/invoice token endpoints, Turnstile, VITE_ specifics, Sentry, and
per-tenant paid-API quotas (StileAI makes no LLM/paid calls; gateway rate-limiting is
the analog, deferred to Phase 2).

## 7. Deployment & multi-tenancy

- The gateway runs as a mode of the checkpoint service — **self-hosted in the
  customer's environment** (so it can reach internal tools and keep data local), or
  StileAI-hosted for public tools. Same one-URL connect, same dashboard control plane.
- Per-org isolation: connected tools and policies are scoped by the API key → org, via
  existing RLS + service-role patterns.
- Config (tools + policies) is pulled from the dashboard and hot-reloaded — no
  redeploy to add a tool or change a rule.

## 8. Cost / margins (context, not a build task)

Unchanged high-margin shape: the gateway is a **proxy + policy check + audit row** —
no LLM. Self-hosted gateway → ~$0 infra to StileAI (customer runs it). Hosted → cheap
proxy bandwidth, meterable as usage tiers (governed tool-calls). ~90% software margins.

## 9. Out of scope

Pricing/packaging (business track, not engineering); the `queue` async path
(fast-follow); non-MCP / raw-HTTP tools (MCP covers the agent ecosystem; adapters
later).

## 10. Success criteria

1. An agent connected to the gateway by **one URL** calls a downstream tool with no
   mention of StileAI.
2. **allow** → the real tool runs, result returned to the agent.
3. **deny** → the tool is blocked, the agent is told, the tool never ran.
4. **hold (wait)** → a pending approval is created with **full detail**; the agent
   pauses; **approve → runs and continues; deny → blocked**; timeout → deny.
5. Every call is in the audit trail with secrets redacted.
6. Tools and policies are the customer's own, added/edited from the dashboard with no
   redeploy.
7. Demo: point any agent at the sample server via the gateway, say "charge a customer
   $5,000," and watch it get held for approval — StileAI never named.

## 11. Phasing

- **Phase 1 (this build):** generic gateway proxy, connected-tools config + dashboard
  page + `/api/tools`, `wait`-mode approvals with detailed approval view, audit,
  security requirements above, sample tools server. Fully testable product.
- **Phase 2 (fast-follow):** `queue` hold mode; header-only auth option; downstream
  credential encryption hardening; hosted-gateway multi-tenant option.
