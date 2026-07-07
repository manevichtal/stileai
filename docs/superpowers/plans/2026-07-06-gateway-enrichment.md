# Gateway Enrichment + Dashboard Catch-up — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the "context" and "velocity" policies actually enforce (the gateway derives the facts a rule needs from the real action, never from the agent), and give the dashboard a simple Connected Tools page so tools can be managed without SQL.

**Architecture:** A stateless `enrich()` step in the gateway adds trustworthy fields (recipient_domain, recipient_count, has_where, env, off_hours, freeze) to a COPY of the call args used ONLY for policy evaluation; velocity counts (actor_action_count_1h, daily_total) come from a new read-only `/api/usage` endpoint that aggregates the existing `audit_log`. A minimal `/connected-tools` dashboard page does CRUD on the `connected_tools` table. Keep it simple — no new tables except one index; no agent-spoofable inputs.

**Tech Stack:** Python 3.12 + `mcp` SDK (gateway); Next.js 16 App Router + Supabase (dashboard). Package mgrs: `uv` (Python), npm (JS).

## Global Constraints

- Python via the existing `interlock-mcp/.venv` (`./.venv/Scripts/python.exe`); `pytest`/`pytest-asyncio` installed; run pytest as `-m pytest` from `interlock-mcp/`. Known pre-existing collection errors in `phase4_mcp_test.py`/`test_urlkey.py` are ignored.
- Node needs `NODE_OPTIONS=--use-system-ca` for build/dev on this machine.
- Never fail open: if `/api/usage` or enrichment fails, the velocity fields are simply absent → the affected (approval-tier) rules don't add restriction; hard denies + default-deny still apply. Never loosen a decision on error.
- **Enriched fields are gateway-derived and OVERRIDE any same-named key the agent sent** — the agent can never spoof them. `env`/`freeze`/business-hours come from operator config, not the request.
- The real downstream tool call uses the ORIGINAL args; enrichment is evaluation-only and never leaks synthetic fields to the tool.
- `org_id`/tenant always from the API key (`resolveOrgId`), never a request body. Secrets never logged.
- Follow existing patterns: `/api/usage` mirrors `dashboard/app/api/tools/route.ts`; the gateway `UsageStore` mirrors `interlock/tools_config.py`'s `ApiToolsStore`; the Connected Tools page follows existing dashboard page/form patterns.

---

## File Structure

**Dashboard (new):**
- `dashboard/app/api/usage/route.ts` — `GET /api/usage?actor=` → `{ actor_action_count_1h, daily_total }` from `audit_log`.
- `dashboard/app/(app)/connected-tools/page.tsx` — list + manage connected tools (server component).
- `dashboard/app/(app)/connected-tools/actions.ts` — server actions: add / toggle-enabled / delete a connected tool (admin + org scoped).
- `dashboard/scripts/verify-usage-api.mjs` — verify script for `/api/usage`.
- `supabase/migration_audit_usage_index.sql` — index on `audit_log(org_id, actor, timestamp)` for cheap counting.

**Gateway (new):**
- `interlock-mcp/interlock/enrichment.py` — `enrich(args, cfg, usage) -> dict` (pure).
- `interlock-mcp/interlock/usage.py` — `ApiUsageStore(cfg)` → `get_usage(actor) -> dict` (fail-safe, mirrors ApiToolsStore).
- `interlock-mcp/tests/test_enrichment.py`, `tests/test_usage.py`.

**Modified:**
- `interlock-mcp/interlock/config.py` — add `ep_usage`, `env`, `business_hours`, `tz`, `freeze`.
- `interlock-mcp/interlock/gateway.py` — call `enrich()` before `_decide` (evaluation params only).
- `dashboard/lib/policyTemplates.ts` — append the `velocity` pack (Bucket B, now enforceable).
- `dashboard/components/…nav` — add a Connected Tools link (follow the existing nav pattern).

---

## Task 1: `/api/usage` endpoint + audit index

**Files:**
- Create: `dashboard/app/api/usage/route.ts`, `supabase/migration_audit_usage_index.sql`, `dashboard/scripts/verify-usage-api.mjs`

**Interfaces:**
- Consumes: `resolveOrgId(req)`, `unauthorized()` (`@/lib/apiAuth`), `createAdminClient()`.
- Produces: `GET /api/usage?actor=<a>` → `{ actor_action_count_1h: number, daily_total: number }` for the key's org. `daily_total` = sum of `params->>'amount'` over the org's audit rows in the last 24h; `actor_action_count_1h` = count of the org's audit rows for `actor` in the last 1h.

- [ ] **Step 1: Migration (index)**

```sql
-- Speeds up per-actor / recent-window counting for velocity policies.
create index if not exists audit_log_org_actor_ts on audit_log (org_id, actor, timestamp desc);
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/usage?actor=<actor> -> prior-activity counters for velocity policies.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();
  const actor = new URL(req.url).searchParams.get("actor") || "";
  const admin = createAdminClient();

  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  // count of this actor's actions in the last hour
  let countQ = admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("timestamp", hourAgo);
  if (actor) countQ = countQ.eq("actor", actor);
  const { count } = await countQ;

  // sum of amount over the org's last 24h (money velocity)
  const { data: rows } = await admin
    .from("audit_log")
    .select("params")
    .eq("org_id", orgId)
    .gte("timestamp", dayAgo)
    .limit(5000);
  let dailyTotal = 0;
  for (const r of rows ?? []) {
    const amt = Number((r.params as Record<string, unknown> | null)?.amount);
    if (Number.isFinite(amt)) dailyTotal += amt;
  }

  return NextResponse.json({
    actor_action_count_1h: count ?? 0,
    daily_total: dailyTotal,
  });
}
```

- [ ] **Step 3: Verify script**

`verify-usage-api.mjs` (mirror `verify-api.mjs`): seed org + key + insert 2 audit rows (one with `params.amount=4000` within 24h; two rows for `actor=agent:default` within 1h); GET `/api/usage?actor=agent:default` with the key → assert `actor_action_count_1h >= 2` and `daily_total >= 4000`; without key → 401; cleanup. (Runs in the live batch, like the gateway e2e.)

- [ ] **Step 4: Commit** — `git add dashboard/app/api/usage/route.ts supabase/migration_audit_usage_index.sql dashboard/scripts/verify-usage-api.mjs && git commit -m "feat(api): GET /api/usage — velocity counters derived from audit_log"`

---

## Task 2: Gateway config for enrichment

**Files:**
- Modify: `interlock-mcp/interlock/config.py`

**Interfaces:**
- Produces on `Config`: `ep_usage: str` (`/api/usage`), `env: str` (`INTERLOCK_ENV`, default `""`), `business_hours: str` (`INTERLOCK_BUSINESS_HOURS`, default `"9-17"`), `tz: str` (`INTERLOCK_TZ`, default `"UTC"`), `freeze: bool` (`INTERLOCK_FREEZE` == "true", default false).

- [ ] **Step 1: Add fields**

Add to the `Config` dataclass and `from_env`:
```python
    ep_usage: str
    env: str
    business_hours: str
    tz: str
    freeze: bool
```
```python
            ep_usage=_env("INTERLOCK_EP_USAGE", "/api/usage"),
            env=_env("INTERLOCK_ENV", ""),
            business_hours=_env("INTERLOCK_BUSINESS_HOURS", "9-17"),
            tz=_env("INTERLOCK_TZ", "UTC"),
            freeze=_env("INTERLOCK_FREEZE", "false").lower() == "true",
```

- [ ] **Step 2: Commit** — `git commit -am "feat(config): gateway enrichment settings (env, business hours, freeze, usage endpoint)"`

---

## Task 3: `enrich()` — derived fields (pure)

**Files:**
- Create: `interlock-mcp/interlock/enrichment.py`, `interlock-mcp/tests/test_enrichment.py`

**Interfaces:**
- Consumes: `Config` (`cfg.env`, `cfg.business_hours`, `cfg.tz`, `cfg.freeze`), a `usage` dict `{actor_action_count_1h, daily_total}` (or `{}` when unavailable), and `now_hour: int` (passed in for testability — the caller supplies the current local hour so the function stays pure/deterministic).
- Produces: `enrich(args: dict, cfg, usage: dict, now_hour: int) -> dict` — returns a NEW dict = copy of `args` with these keys SET (overriding any agent value):
  - `recipient_domain`: domain of the first of `to`/`recipient`/`email` (str after `@`), else omitted.
  - `recipient_count`: len of `recipients`/`to` if a list, else 1 if a single recipient field present, else omitted.
  - `has_where`: `bool(args.get("where") or args.get("filter"))` — only set when the tool looks like a delete/update (i.e. `where`/`filter`/`table` present).
  - `env`: `cfg.env` if set.
  - `off_hours`: `True/False` from `now_hour` vs `cfg.business_hours` (`"9-17"` → business hours are 9..16; off_hours = hour < 9 or hour >= 17), only set when `cfg.business_hours` is set.
  - `freeze`: `cfg.freeze` (always set as a bool).
  - `actor_action_count_1h`, `daily_total`: from `usage` when present.

- [ ] **Step 1: Failing test**

```python
# tests/test_enrichment.py
from interlock.enrichment import enrich

class Cfg:
    env = "prod"; business_hours = "9-17"; tz = "UTC"; freeze = True

def test_enrich_overrides_agent_and_derives_fields():
    args = {"to": "alice@gmail.com", "env": "dev", "recipient_domain": "safe.com"}
    out = enrich(args, Cfg(), {"actor_action_count_1h": 5, "daily_total": 9000}, now_hour=22)
    assert out["recipient_domain"] == "gmail.com"   # agent's "safe.com" overridden
    assert out["recipient_count"] == 1
    assert out["env"] == "prod"                      # agent's "dev" overridden by config
    assert out["off_hours"] is True                  # 22:00 is off hours
    assert out["freeze"] is True
    assert out["daily_total"] == 9000
    assert args["env"] == "dev"                      # original args untouched (copy)

def test_enrich_has_where_and_mass_recipients():
    out = enrich({"table": "orders", "where": ""}, Cfg(), {}, now_hour=10)
    assert out["has_where"] is False                 # empty where
    out2 = enrich({"recipients": ["a@x.com","b@y.com"]}, Cfg(), {}, now_hour=10)
    assert out2["recipient_count"] == 2 and out2["off_hours"] is False
```

- [ ] **Step 2: Run → fail.** `./.venv/Scripts/python.exe -m pytest tests/test_enrichment.py -q`

- [ ] **Step 3: Implement**

```python
# interlock/enrichment.py
"""Derive trustworthy policy fields from the REAL action + operator config.

Every field here is computed by the gateway, never taken from the agent: the
returned dict overrides any same-named key the agent sent. Used only for policy
evaluation — the real tool call keeps the original args.
"""
from __future__ import annotations

from typing import Any


def _first_recipient(args: dict[str, Any]) -> str | None:
    for k in ("to", "recipient", "email"):
        v = args.get(k)
        if isinstance(v, str) and v:
            return v
        if isinstance(v, list) and v and isinstance(v[0], str):
            return v[0]
    return None


def _recipient_count(args: dict[str, Any]) -> int | None:
    for k in ("recipients", "to", "cc", "bcc"):
        v = args.get(k)
        if isinstance(v, list):
            return len(v)
    if _first_recipient(args) is not None:
        return 1
    return None


def _business_hours(spec: str) -> tuple[int, int] | None:
    try:
        start, end = spec.split("-")
        return int(start), int(end)
    except Exception:
        return None


def enrich(args: dict[str, Any], cfg, usage: dict[str, Any], now_hour: int) -> dict[str, Any]:
    out = dict(args)  # copy — never mutate the caller's args

    rcpt = _first_recipient(args)
    if rcpt and "@" in rcpt:
        out["recipient_domain"] = rcpt.split("@", 1)[1].lower()
    count = _recipient_count(args)
    if count is not None:
        out["recipient_count"] = count

    if any(k in args for k in ("where", "filter", "table")):
        out["has_where"] = bool(args.get("where") or args.get("filter"))

    if getattr(cfg, "env", ""):
        out["env"] = cfg.env

    bh = _business_hours(getattr(cfg, "business_hours", "") or "")
    if bh:
        start, end = bh
        out["off_hours"] = now_hour < start or now_hour >= end

    out["freeze"] = bool(getattr(cfg, "freeze", False))

    for k in ("actor_action_count_1h", "daily_total"):
        if k in (usage or {}):
            out[k] = usage[k]
    return out
```

- [ ] **Step 4: Run → pass.** **Step 5: Commit** — `git add interlock-mcp/interlock/enrichment.py interlock-mcp/tests/test_enrichment.py && git commit -m "feat(gateway): enrich() derives trustworthy policy fields, overrides agent input"`

---

## Task 4: `ApiUsageStore` — fetch velocity counts (fail-safe)

**Files:**
- Create: `interlock-mcp/interlock/usage.py`, `interlock-mcp/tests/test_usage.py`

**Interfaces:**
- Produces: `ApiUsageStore(cfg, transport=None)` with `get_usage(actor: str) -> dict` → `{actor_action_count_1h, daily_total}` from `GET cfg.ep_usage?actor=`; returns `{}` on ANY error (never raises, never fails open). Mirrors `ApiToolsStore` exactly (self-contained httpx client, `transport=` for tests).

- [ ] **Step 1: Failing test** (mirror `test_tools_config.py`): MockTransport returns `{actor_action_count_1h:3, daily_total:1200}` → assert returned; ConnectError → `{}`. Assert the Bearer auth header and the `actor` query param are sent.
- [ ] **Step 2–4:** Implement mirroring `interlock/tools_config.py` (GET `cfg.ep_usage`, params `{"actor": actor}`, return `r.json()`; except → `{}`). Run → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(gateway): ApiUsageStore fetches velocity counters (fail-safe)"`

---

## Task 5: Wire enrichment into `gateway.call_tool`

**Files:**
- Modify: `interlock-mcp/interlock/gateway.py`, `interlock-mcp/interlock/server.py` (pass a usage store into the gateway)

**Interfaces:**
- Consumes: `enrich`, `ApiUsageStore`, `datetime` for the current local hour.
- Produces: in `call_tool`, before `_decide`: fetch `usage = usage_store.get_usage(actor)` (if a store is wired; else `{}`), compute `now_hour` from the gateway's clock (`datetime.now().hour`), build `eval_params = enrich(args, cfg, usage, now_hour)`, and evaluate policy with `eval_params` INSTEAD of raw `args`. The downstream `.call(real, args)` still uses the ORIGINAL `args`. Audit records the original `args` (redacted) as today.
- `build_gateway_server(downstreams, provider, audit, cfg, actor=..., usage_store=None)` — add the optional `usage_store` param; `_build_gateway_http_app` constructs `ApiUsageStore(cfg)` and passes it.

- [ ] **Step 1: Failing test** — extend `tests/test_gateway.py`: a `_decide` call with enriched params denies when a velocity field trips a rule. E.g. engine with rule `require_approval action=charge_card conditions=[amount gt 100]` plus `deny action=charge_card conditions=[daily_total gt 5000]` (lower priority) → `_decide(eng, actor, "charge_card", "sample:charge_card", enrich({"amount":50}, Cfg, {"daily_total":9000}, 10))` returns deny. (Confirms enriched fields flow into evaluation. Keep it a pure `_decide`+`enrich` test — no MCP wiring.)
- [ ] **Step 2: Run → fail** (if the wiring/import isn't there) **or** write the small integration in `call_tool`.
- [ ] **Step 3: Implement** the `call_tool` change (enrich eval params; keep original args for the downstream call + audit) and thread `usage_store` through `build_gateway_server` + `_build_gateway_http_app`. Guard: if `usage_store` is None, `usage = {}`.
- [ ] **Step 4: Run** `tests/test_gateway.py` + full suite → green.
- [ ] **Step 5: Commit** — `git commit -am "feat(gateway): evaluate policies against enriched params (agent-proof); real call keeps original args"`

---

## Task 6: `velocity` policy pack (Bucket B, now enforceable)

**Files:**
- Modify: `dashboard/lib/policyTemplates.ts`

**Interfaces:**
- Produces: append one pack `key: "velocity"` (name "Velocity & context", framework "Runaway-agent & context controls") with templates using the now-derivable fields ONLY. Priorities per the existing bands (denies < approvals < allows < 999).

- [ ] **Step 1:** Append the pack (no test framework here; correctness is the field/priority mapping). Templates:
  - `velocity-approve-external-email` (require_approval, prio 26): action `email.send`, conditions `[{field:"recipient_domain", op:"not_in", value:["yourcompany.com"]}]`, description notes admins edit the domain list.
  - `velocity-approve-mass-email` (require_approval, 26): action `email.send`, `[{recipient_count, gt, 25}]`.
  - `velocity-deny-delete-no-filter` (deny, 12): action `db.delete`, `[{has_where, eq, false}]`.
  - `velocity-approve-off-hours` (require_approval, 27): action `deploy.*`, `[{off_hours, eq, true}]`.
  - `velocity-approve-prod-deploy` (require_approval, 24): action `deploy.*`, `[{env, eq, "prod"}]`.
  - `velocity-approve-daily-spend-cap` (require_approval, 26): action `payment.*`, `[{daily_total, gt, 5000}]`.
  - `velocity-approve-high-frequency` (require_approval, 28): action `*`, `[{actor_action_count_1h, gt, 100}]`.
  - `velocity-deny-freeze-window` (deny, 11): action `deploy.*`, `[{freeze, eq, true}]` (also a sibling for `db.migrate`).
- [ ] **Step 2:** Confirm `tsc --noEmit` clean + no duplicate `policy_id` (the node grep check from Bucket A). **Commit** — `git commit -m "feat(policy-library): velocity & context pack (enforceable via enrichment)"`

---

## Task 7: Connected Tools dashboard page

**Files:**
- Create: `dashboard/app/(app)/connected-tools/page.tsx`, `dashboard/app/(app)/connected-tools/actions.ts`
- Modify: the app nav (add a "Connected tools" link, following the existing nav component pattern)

**Interfaces:**
- Consumes: `requireProfileContext()` (`@/lib/getProfile` — gives `orgId`, `role`), `createServerClient`/`createAdminClient` per existing page patterns.
- Produces: a page listing the org's `connected_tools` (name, transport, target, enabled) with: an **Add** form (name, transport select stdio|http, target text), a **toggle enabled**, and a **delete**. Server actions are admin-only + org-scoped (mirror how existing admin pages/actions check `role === "admin"` and filter by `orgId`).

- [ ] **Step 1:** Read an existing simple admin page + its server action (e.g. `keys` or `policies` page) to copy the pattern (auth guard, form, `revalidatePath`).
- [ ] **Step 2:** Write `actions.ts`: `addTool(formData)`, `setToolEnabled(id, enabled)`, `deleteTool(id)` — each `requireProfileContext()`, assert `role === "admin"`, and write via admin client filtered by `orgId` (the RLS also enforces this, but filter explicitly). `target` is stored as text (for stdio, a JSON array string; show a hint). `auth` left null in the UI (encrypted-cred entry is a later phase — the form omits it).
- [ ] **Step 3:** Write `page.tsx`: list + Add form + toggle + delete, styled like existing pages. Add the nav link.
- [ ] **Step 4:** Verify it builds: `cd dashboard && NODE_OPTIONS=--use-system-ca npm run build` succeeds (page compiles). (Full click-through happens in the live test.)
- [ ] **Step 5: Commit** — `git add dashboard/app/(app)/connected-tools dashboard/... (nav) && git commit -m "feat(dashboard): Connected Tools page (add/enable/delete, admin+org scoped)"`

---

## Live batch (controller-run, after the tasks)

1. Apply `supabase/migration_audit_usage_index.sql` (one line; human runs it, like the connected_tools migration).
2. Build the dashboard (prod) + run it; run `verify-usage-api.mjs`.
3. Run an extended gateway e2e: seed a policy `deny charge_card when daily_total gt 5000`, push the org over $5k via audit rows, confirm a charge is now blocked by the velocity rule (proves enrichment end-to-end). Reuse `gateway_e2e.py` patterns.
4. Click through the Connected Tools page (add the sample tool via UI instead of SQL).

## Deploy (controller + human)
Merge `feature/enforced-gateway` → `main` (Vercel auto-deploys the dashboard: `/api/tools`, `/api/usage`, Connected Tools page, policy packs). Confirm with the human before pushing (it changes the live site). The gateway runs self-hosted pointed at the live dashboard; before hosting the gateway publicly, wire `TransportSecuritySettings`/`INTERLOCK_MCP_ALLOWED_HOSTS` into `build_gateway_app` (logged follow-up).

---

## Self-Review

- **Spec coverage:** derived fields (T3) ✅; velocity from audit_log via /api/usage (T1,T4) ✅; wired evaluation-only, agent-proof, original args to tool (T5) ✅; enforceable policies added (T6) ✅; dashboard catch-up = Connected Tools page (T7) ✅; config (T2) ✅; fail-safe never-open (T1,T4,T5) ✅. Deferred (spec §4/§6): rows_affected/PII/moderation/legal-hold/lists — not shipped as rules.
- **Simplicity:** one index (no new tables); counters reuse the audit trail; enrichment is one pure function; the page is basic CRUD. No new infrastructure.
- **Type consistency:** `enrich(args,cfg,usage,now_hour)`, `ApiUsageStore(cfg).get_usage(actor)`, `/api/usage` shape `{actor_action_count_1h,daily_total}`, `build_gateway_server(...,usage_store=None)` — consistent across tasks.
