# Enforced Gateway — Vertical Slice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an AI agent connect to one StileAI gateway URL, use its normal tools, and have every tool call transparently governed (allow / deny / hold-for-approval) — proven end-to-end against a bundled sample tools server.

**Architecture:** The gateway is a new low-level MCP server in `interlock-mcp` that connects (as an MCP client) to the org's configured downstream tool servers, aggregates their tools, and re-exposes them. On each tool call it runs the existing policy engine, then forwards (allow), refuses (deny), or creates a pending approval and waits (hold). Downstream-tool config lives in Supabase and is served to the gateway by a new `/api/tools` dashboard route. Everything reuses the existing engine, audit, approvals, and `?key=` auth.

**Tech Stack:** Python 3.12, `mcp` SDK (official, v1.28) low-level `Server` + client (`streamablehttp_client`, `stdio_client`), FastAPI/uvicorn, httpx; Next.js 16 API route; Supabase Postgres. Package mgr: `uv` (Python), npm (JS).

## Global Constraints

- Python: `mcp>=1.27,<2`, PyYAML, httpx only (no new runtime deps without noting). Local Python via **uv**; `UV_SYSTEM_CERTS=1`.
- Node needs `NODE_OPTIONS=--use-system-ca` for build/dev on this machine.
- Never fail open: unreachable control plane or missing policy → **deny**.
- `org_id`/tenant is always derived from the API key (never a request body).
- Dashboard is the source of truth; gateway pulls config + policies over HTTP with the API key, hot-reloads, and serves last-known-good on transient failure (deny if never loaded).
- Secrets never logged; the `?key=` token never printed. Audit params already redacted by `audit.redact`.
- Commit after each task. Tests live beside the code they cover under `interlock-mcp/tests/` (pytest) or `dashboard/scripts/` (node verify scripts, the established pattern).

---

## File Structure

**New (Python — `interlock-mcp/`):**
- `interlock/downstream.py` — connects to one downstream MCP server (http or stdio), lists + calls its tools. One responsibility: talk to a downstream.
- `interlock/gateway.py` — the gateway MCP server: aggregates downstreams, gates each call via the engine, does audit + wait-mode approvals.
- `interlock/tools_config.py` — loads the org's connected-tools list from the dashboard `/api/tools` (with last-known-good cache), mirrors `ApiPolicyStore`.
- `sample_tools/server.py` — the demo downstream MCP server (`send_email`, `charge_card`, `delete_records`, `read_data`).
- `tests/test_downstream.py`, `tests/test_gateway.py`, `tests/test_tools_config.py`.

**Modified (Python):**
- `interlock/config.py` — add gateway settings (`ep_tools`, gateway enable).
- `interlock/server.py` — mount the gateway surface at `/gw`; keep `/mcp` (advisory tools) as-is.

**New (dashboard — `dashboard/`):**
- `app/api/tools/route.ts` — `GET /api/tools` (API-key auth) → the org's connected tools.
- `scripts/verify-gateway.mjs` — end-to-end verify (seed org+key+tool, run gateway, drive an agent, assert allow/deny/hold + audit).

**Modified (dashboard):**
- `lib/apiAuth.ts` — reused as-is (no change) for `/api/tools`.

**Database:** one migration file `supabase/migration_connected_tools.sql` (human applies in Supabase SQL editor; the plan states when).

---

## Task 1: `connected_tools` table (migration)

**Files:**
- Create: `supabase/migration_connected_tools.sql`

**Interfaces:**
- Produces: table `connected_tools(id uuid, org_id uuid, name text, transport text, target text, auth text, enabled bool, created_at)`, RLS admin+org scoped, encryption CHECK on `auth`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- StileAI: downstream tools the gateway proxies, per org.
create table if not exists connected_tools (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,                 -- shown to the agent as the tool group
  transport  text not null check (transport in ('http','stdio')),
  target     text not null,                 -- http: URL ; stdio: JSON [command, ...args]
  auth       text,                          -- encrypted secret for the downstream (enc:...)
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name),
  check (auth is null or auth like 'enc:%')  -- never store plaintext downstream creds
);
create index if not exists connected_tools_org on connected_tools(org_id);

alter table connected_tools enable row level security;

-- admin-only + org-scoped (holds credentials)
create policy connected_tools_admin_rw on connected_tools
  for all
  using (
    org_id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    org_id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

- [ ] **Step 2: Have the human apply it**

Tell the user: run the file's contents in Supabase → SQL Editor → Run (same as the initial schema). Confirm "Success. No rows returned."

- [ ] **Step 3: Verify the table + RLS exist**

Run (PowerShell, service role):
```
Invoke-WebRequest "$base/connected_tools?select=id&limit=1" -Headers $h
```
Expected: HTTP 200 (empty array).

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_connected_tools.sql
git commit -m "feat(db): connected_tools table (admin+org RLS, encrypted creds)"
```

---

## Task 2: `GET /api/tools` route (gateway pulls its config)

**Files:**
- Create: `dashboard/app/api/tools/route.ts`
- Test: `dashboard/scripts/verify-tools-api.mjs`

**Interfaces:**
- Consumes: `resolveOrgId(req)` from `@/lib/apiAuth` (returns `string | null`), `createAdminClient()`.
- Produces: `GET /api/tools` → `{ tools: [{ name, transport, target, auth, enabled }] }` for the key's org; 401 without a valid key.

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tools -> the org's enabled downstream tools, for the gateway to proxy.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();
  const admin = createAdminClient();
  const { data } = await admin
    .from("connected_tools")
    .select("name, transport, target, auth, enabled")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("name");
  return NextResponse.json({ tools: data ?? [] });
}
```

- [ ] **Step 2: Write the verify script**

`dashboard/scripts/verify-tools-api.mjs`: seed an org + api key + one `connected_tools` row (service role), then `fetch(BASE + "/api/tools", {headers:{Authorization:`Bearer ${key}`}})`, assert `200` and the tool is returned; assert `401` with no key; clean up. (Mirror `scripts/verify-api.mjs`.)

- [ ] **Step 3: Run it (dev server up)**

Run: `node scripts/verify-tools-api.mjs`
Expected: `ALL CHECKS PASSED`.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/api/tools/route.ts dashboard/scripts/verify-tools-api.mjs
git commit -m "feat(api): GET /api/tools serves the org's downstream tools to the gateway"
```

---

## Task 3: Sample tools server (demo downstream)

**Files:**
- Create: `interlock-mcp/sample_tools/server.py`
- Test: `interlock-mcp/tests/test_sample_tools.py`

**Interfaces:**
- Produces: an MCP stdio server exposing tools `read_data(query)`, `send_email(to, subject, body)`, `charge_card(customer, amount)`, `delete_records(table, where)`. Each returns a JSON string describing the (fake) side effect. Run via `python -m sample_tools.server`.

- [ ] **Step 1: Write a failing test**

```python
# tests/test_sample_tools.py
import json
from sample_tools.server import TOOLS  # dict name -> callable

def test_charge_card_returns_receipt():
    out = json.loads(TOOLS["charge_card"](customer="c1", amount=4200))
    assert out["performed"] is True and out["amount"] == 4200
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_sample_tools.py -q`
Expected: FAIL (module/attr missing).

- [ ] **Step 3: Implement the sample server**

```python
# sample_tools/server.py
"""Demo downstream MCP server with realistic risky tools. NOT real side effects."""
import json
from mcp.server.fastmcp import FastMCP

def _read_data(query: str = "") -> str:
    return json.dumps({"performed": True, "rows": [{"id": 1}, {"id": 2}], "query": query})

def _send_email(to: str, subject: str = "", body: str = "") -> str:
    return json.dumps({"performed": True, "detail": f"(demo) email to {to}"})

def _charge_card(customer: str, amount: float) -> str:
    return json.dumps({"performed": True, "customer": customer, "amount": amount,
                       "detail": "(demo) card charged"})

def _delete_records(table: str, where: str = "") -> str:
    return json.dumps({"performed": True, "detail": f"(demo) deleted from {table} where {where}"})

TOOLS = {"read_data": _read_data, "send_email": _send_email,
         "charge_card": _charge_card, "delete_records": _delete_records}

mcp = FastMCP("sample-tools")
mcp.tool()(_read_data)
mcp.tool()(_send_email)
mcp.tool()(_charge_card)
mcp.tool()(_delete_records)

def main() -> None:
    mcp.run()  # stdio

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_sample_tools.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/sample_tools/server.py interlock-mcp/tests/test_sample_tools.py
git commit -m "feat(sample): demo downstream tools server (read/email/charge/delete)"
```

---

## Task 4: Downstream connector (`downstream.py`)

**Files:**
- Create: `interlock-mcp/interlock/downstream.py`
- Test: `interlock-mcp/tests/test_downstream.py`

**Interfaces:**
- Produces:
  - `class Downstream` with `async def start()` (connect + `list_tools`), `async def list_tools() -> list[Tool]`, `async def call(tool: str, args: dict) -> CallToolResult`, `async def close()`.
  - Constructed from a config dict `{name, transport, target, auth}`. For `stdio`, `target` is a JSON list `[command, *args]`; for `http`, `target` is a URL and `auth` (decrypted) becomes `Authorization: Bearer <auth>`.

- [ ] **Step 1: Write a failing test (stdio against the sample server)**

```python
# tests/test_downstream.py
import pytest
from interlock.downstream import Downstream

@pytest.mark.asyncio
async def test_downstream_lists_and_calls_sample_tools():
    d = Downstream({"name": "sample", "transport": "stdio",
                    "target": '["python", "-m", "sample_tools.server"]', "auth": None})
    await d.start()
    names = {t.name for t in await d.list_tools()}
    assert {"charge_card", "read_data"} <= names
    res = await d.call("read_data", {"query": "x"})
    assert res.content  # got a result back
    await d.close()
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_downstream.py -q`
Expected: FAIL (module missing). (Add `pytest-asyncio` to the dev venv: `uv pip install --python .venv pytest pytest-asyncio` and set `asyncio_mode=auto` in `pyproject.toml [tool.pytest.ini_options]`.)

- [ ] **Step 3: Implement `Downstream`**

```python
# interlock/downstream.py
from __future__ import annotations
import json
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, types
from mcp.client.stdio import stdio_client, StdioServerParameters
from mcp.client.streamable_http import streamablehttp_client


class Downstream:
    def __init__(self, cfg: dict[str, Any]):
        self._cfg = cfg
        self._stack = AsyncExitStack()
        self._session: ClientSession | None = None

    async def start(self) -> None:
        transport = self._cfg["transport"]
        if transport == "stdio":
            parts = json.loads(self._cfg["target"])
            params = StdioServerParameters(command=parts[0], args=parts[1:])
            read, write = await self._stack.enter_async_context(stdio_client(params))
        else:  # http
            headers = {}
            auth = self._cfg.get("auth")
            if auth:
                headers["Authorization"] = f"Bearer {auth}"
            read, write, _ = await self._stack.enter_async_context(
                streamablehttp_client(self._cfg["target"], headers=headers)
            )
        self._session = await self._stack.enter_async_context(ClientSession(read, write))
        await self._session.initialize()

    async def list_tools(self) -> list[types.Tool]:
        assert self._session
        return (await self._session.list_tools()).tools

    async def call(self, tool: str, args: dict[str, Any]) -> types.CallToolResult:
        assert self._session
        return await self._session.call_tool(tool, args)

    async def close(self) -> None:
        await self._stack.aclose()
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_downstream.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/interlock/downstream.py interlock-mcp/tests/test_downstream.py interlock-mcp/pyproject.toml
git commit -m "feat(gateway): Downstream connector (stdio + http MCP clients)"
```

---

## Task 5: Gateway server — aggregate + gate (allow/deny) + audit

**Files:**
- Create: `interlock-mcp/interlock/gateway.py`
- Test: `interlock-mcp/tests/test_gateway.py`

**Interfaces:**
- Consumes: `PolicyProvider.engine()` (from `server.py`, exposes `.evaluate(actor, action, resource, params) -> Decision`), `AuditSink.record(**entry)`, `Downstream`.
- Produces:
  - `def build_gateway_server(downstreams: list[Downstream], provider, audit, actor: str) -> mcp.server.Server` — a low-level MCP `Server` whose `list_tools` returns the union of downstream tools (namespaced `name__tool`), and whose `call_tool` evaluates policy then forwards on **allow**, returns a refusal on **deny**. (Hold handled in Task 6.)
  - Action mapping: `action = <tool>` (the bare downstream tool name), `params = args`, `resource = args.get("resource") or "*"`, `actor` = configured.

- [ ] **Step 1: Write a failing test (deny a drop, allow a read)**

```python
# tests/test_gateway.py — uses a fake downstream + a real engine
import pytest
from interlock.engine import PolicyEngine, load_policies_from_dict
from interlock.gateway import build_gateway_server, _decide  # _decide: pure policy step

def _engine():
    return load_policies_from_dict({
        "default_effect": "deny",
        "policies": [
            {"id": "allow-reads", "effect": "allow", "priority": 10, "action": "read_data"},
            {"id": "deny-delete", "effect": "deny", "priority": 5, "action": "delete_records"},
        ],
    })

def test_decide_allows_read_denies_delete():
    eng = _engine()
    assert _decide(eng, "agent:default", "read_data", {}).effect.value == "allow"
    assert _decide(eng, "agent:default", "delete_records", {"table": "t"}).effect.value == "deny"
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway.py -q`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the gateway (allow/deny path)**

```python
# interlock/gateway.py
from __future__ import annotations
import json
from typing import Any

import mcp.types as types
from mcp.server.lowlevel import Server

from .engine import Decision, Effect, PolicyEngine


def _decide(engine: PolicyEngine, actor: str, tool: str, args: dict[str, Any]) -> Decision:
    resource = str(args.get("resource") or "*")
    return engine.evaluate(actor, tool, resource, args)


def build_gateway_server(downstreams, provider, audit, actor: str = "agent:default") -> Server:
    # map exposed tool name -> (downstream, real tool name)
    routing: dict[str, tuple[Any, str]] = {}
    server = Server("stileai-gateway")

    async def _refresh_routing():
        routing.clear()
        for d in downstreams:
            for t in await d.list_tools():
                routing[f"{d._cfg['name']}__{t.name}"] = (d, t)

    @server.list_tools()
    async def list_tools() -> list[types.Tool]:
        await _refresh_routing()
        out = []
        for exposed, (_d, t) in routing.items():
            out.append(types.Tool(name=exposed, description=t.description,
                                  inputSchema=t.inputSchema))
        return out

    @server.call_tool()
    async def call_tool(name: str, args: dict[str, Any]) -> list[types.ContentBlock]:
        if name not in routing:
            await _refresh_routing()
        entry = routing.get(name)
        if not entry:
            return [types.TextContent(type="text", text=f"unknown tool {name}")]
        d, tool = entry
        real = tool.name
        decision = _decide(provider.engine(), actor, real, args)
        status = {Effect.ALLOW: "allowed", Effect.DENY: "denied",
                  Effect.REQUIRE_APPROVAL: "pending"}[decision.effect]
        decision_id = audit.record(actor=actor, action=real, resource=str(args.get("resource") or "*"),
                                   params=args, effect=decision.effect.value,
                                   matched_policy=decision.matched_policy, reason=decision.reason,
                                   status=status)
        if decision.effect == Effect.ALLOW:
            res = await d.call(real, args)
            return list(res.content)
        if decision.effect == Effect.DENY:
            return [types.TextContent(type="text",
                    text=json.dumps({"performed": False, "blocked_by": "stileai",
                                     "reason": decision.reason}))]
        # REQUIRE_APPROVAL handled in Task 6
        return [types.TextContent(type="text",
                text=json.dumps({"performed": False, "pending": True,
                                 "decision_id": decision_id, "reason": decision.reason}))]

    return server
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/interlock/gateway.py interlock-mcp/tests/test_gateway.py
git commit -m "feat(gateway): aggregate downstream tools; gate allow/deny; audit every call"
```

---

## Task 6: Hold = create approval + wait for the human

**Files:**
- Modify: `interlock-mcp/interlock/gateway.py` (the `REQUIRE_APPROVAL` branch)
- Test: `interlock-mcp/tests/test_gateway_hold.py`

**Interfaces:**
- Consumes: `audit.add_pending(PendingDecision)`, `audit.get_pending(decision_id) -> PendingDecision | None` (status: pending|approved|denied). Poll settings from `cfg.poll_interval` and a hold timeout `cfg.hold_timeout` (new, default 300s).
- Produces: on hold → create pending, poll `get_pending` until `status != pending` or timeout; **approved** → forward to downstream + return result; **denied/timeout** → return refusal. Behavior parameterized so Task 7 can inject a fast fake clock/sink.

- [ ] **Step 1: Write a failing test (hold → approve → forwards)**

```python
# tests/test_gateway_hold.py
import asyncio, json, pytest
from interlock.gateway import wait_for_approval  # pure helper we add

class FakeSink:
    def __init__(self): self.status = "pending"
    def get_pending(self, did):
        class P:  # minimal
            status = self.status
        return P()

@pytest.mark.asyncio
async def test_wait_returns_when_approved():
    sink = FakeSink()
    async def approve_soon():
        await asyncio.sleep(0.05); sink.status = "approved"
    asyncio.create_task(approve_soon())
    result = await wait_for_approval(sink, "d1", poll=0.01, timeout=2)
    assert result == "approved"

@pytest.mark.asyncio
async def test_wait_times_out_to_denied():
    sink = FakeSink()
    result = await wait_for_approval(sink, "d1", poll=0.01, timeout=0.05)
    assert result == "denied"   # fail-safe
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway_hold.py -q`
Expected: FAIL (`wait_for_approval` missing).

- [ ] **Step 3: Implement `wait_for_approval` + wire the hold branch**

```python
# add to interlock/gateway.py
import asyncio, time

async def wait_for_approval(audit, decision_id: str, poll: float, timeout: float) -> str:
    """Return 'approved' or 'denied' (timeout -> 'denied', fail-safe)."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        p = audit.get_pending(decision_id)
        if p is not None and getattr(p, "status", "pending") != "pending":
            return "approved" if p.status == "approved" else "denied"
        await asyncio.sleep(poll)
    return "denied"
```

Replace the `REQUIRE_APPROVAL` branch in `call_tool` with:

```python
        # REQUIRE_APPROVAL
        from .audit import PendingDecision
        audit.add_pending(PendingDecision(
            decision_id=decision_id, actor=actor, action=real,
            resource=str(args.get("resource") or "*"), params=args,
            reason=decision.reason, matched_policy=decision.matched_policy,
            approvals_required=decision.approvals_required))
        outcome = await wait_for_approval(audit, decision_id,
                                          poll=max(1.0, provider._cfg.poll_interval / 10),
                                          timeout=provider._cfg.hold_timeout)
        if outcome == "approved":
            res = await d.call(real, args)
            return list(res.content)
        return [types.TextContent(type="text",
                text=json.dumps({"performed": False, "blocked_by": "stileai",
                                 "reason": "not approved", "decision_id": decision_id}))]
```

Add `hold_timeout` to `Config.from_env` (`INTERLOCK_HOLD_TIMEOUT`, default `300`).

- [ ] **Step 4: Run the tests, verify they pass**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway_hold.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/interlock/gateway.py interlock-mcp/interlock/config.py interlock-mcp/tests/test_gateway_hold.py
git commit -m "feat(gateway): hold = create approval and wait; approve->forward, deny/timeout->block"
```

---

## Task 7: Tools config loader (`tools_config.py`)

**Files:**
- Create: `interlock-mcp/interlock/tools_config.py`
- Test: `interlock-mcp/tests/test_tools_config.py`

**Interfaces:**
- Consumes: the shared `_Http` helper pattern from `stores.py` (or a fresh httpx client with `cfg.auth_headers()`), `cfg.ep_tools` (new, default `/api/tools`).
- Produces: `class ApiToolsStore` with `def get_tools(self) -> list[dict]` returning the org's connected tools, last-known-good cache on failure, `[]` if never loaded.

- [ ] **Step 1–5:** Mirror `ApiPolicyStore` in `stores.py`: fetch `cfg.ep_tools`, return `data["tools"]`, cache; on exception return cache or `[]`. Test with a mock (reuse `test_api_store.py`'s mock-dashboard approach). Add `ep_tools=_env("INTERLOCK_EP_TOOLS","/api/tools")` to `config.py`. Commit `feat(gateway): load connected-tools config from the dashboard`.

---

## Task 8: Mount the gateway at `/gw` in `server.py`

**Files:**
- Modify: `interlock-mcp/interlock/server.py` (`_build_http_app`, `main`)

**Interfaces:**
- Consumes: `build_gateway_server`, `Downstream`, `ApiToolsStore`, the existing auth middleware.
- Produces: when `INTERLOCK_TRANSPORT=http` and store=`api`, the ASGI app also serves the gateway's streamable-HTTP at `/gw` (same `?key=`/header auth). On startup: load tools config, construct one `Downstream` per tool, `start()` them, build the gateway server, mount its streamable app under `/gw`.

- [ ] **Step 1: Add a session-manager + mount for the gateway**

Build the low-level server's streamable app via `mcp.server.streamable_http_manager` (create a `StreamableHTTPSessionManager(app=gateway_server, ...)`) and mount it in the Starlette app returned by `_build_http_app` under path `/gw`, wrapped by the same token gate. Manage downstream lifecycles in the app lifespan (start on startup, close on shutdown).

- [ ] **Step 2: Manual smoke (local)**

Start: `INTERLOCK_STORE=api INTERLOCK_TRANSPORT=http PORT=8030 INTERLOCK_MCP_AUTH_TOKEN=t INTERLOCK_DASHBOARD_URL=http://localhost:3000 INTERLOCK_API_KEY=<seeded> python -m interlock.server` (with a `connected_tools` row pointing at the sample server via stdio).
Then connect an MCP client to `http://localhost:8030/gw?key=t`, `list_tools` → see `sample__charge_card` etc.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(gateway): serve the gateway at /gw (token-gated), wire downstream lifecycles"
```

---

## Task 9: End-to-end verify (`verify-gateway.mjs`)

**Files:**
- Create: `dashboard/scripts/verify-gateway.mjs` + a small Python client `interlock-mcp/gateway_e2e.py`

**Interfaces:**
- Produces: a test that seeds an org + api key + policies (allow read, deny delete, approve charge) + a `connected_tools` row (stdio → sample server), runs the gateway locally, drives an MCP client at `/gw?key=`, and asserts: `read_data`→result, `delete_records`→blocked JSON, `charge_card`→hold→(auto-approve via dashboard resolve)→forwarded result. Confirms audit rows appear for the org. Cleans up.

- [ ] **Step 1:** Write `gateway_e2e.py` (truststore + streamablehttp client to `/gw?key=`, call the three tools; for the charge, spawn a task that approves via the dashboard `/api/approvals/{id}/resolve` with the api key after 1s).
- [ ] **Step 2:** Write `verify-gateway.mjs` to seed/orchestrate/assert/cleanup (mirror `phase4-seed.mjs` + `phase4-verify.mjs`).
- [ ] **Step 3:** Run end-to-end; expected: `GATEWAY E2E: ALL CHECKS PASSED` and audit rows present.
- [ ] **Step 4:** Commit `test(gateway): end-to-end allow/deny/hold through the gateway`.

---

## Task 10: Demo doc

**Files:**
- Create: `interlock-mcp/GATEWAY_DEMO.md`

- [ ] **Step 1:** Write a 1-page runbook: add a `connected_tools` row for the sample server, connect Claude to `/gw?key=…`, say "charge a customer $4,200" → watch it hold; approve in the dashboard → it completes; "delete the customers table" → blocked. No "using StileAI."
- [ ] **Step 2:** Commit `docs: gateway demo runbook`.

---

## Self-Review

- **Spec coverage:** gateway proxy (T4/5/8) ✅; connected-tools config (T1/2/7) ✅; allow/deny/hold-wait (T5/6) ✅; audit every call (T5) ✅; approve→forward, deny/timeout→block (T6) ✅; sample server (T3) ✅; one-URL `?key=` auth reused (T8) ✅; demo (T9/10) ✅. Deferred to Plan 2/3 (explicitly): security hardenings (fail-closed token, append-only audit, admin-role RLS already in T1, error hygiene, cred encryption enforcement — CHECK is in T1 but the encrypt/decrypt helper + dashboard write path are Plan 3), detailed approval UI, queue mode. Downstream credential **encryption helper** + dashboard "Connected tools" CRUD UI are Plan 3; Plan 1 seeds `connected_tools` rows directly for the demo.
- **Placeholders:** none — code shown for every implementing step; T7/T9/T10 reference concrete existing files to mirror.
- **Type consistency:** `_decide`, `wait_for_approval`, `build_gateway_server`, `Downstream.{start,list_tools,call,close}`, `ApiToolsStore.get_tools`, `resolveOrgId`, `/api/tools` shape used consistently across tasks.

---

## Execution note

This plan produces a **working, demoable gateway** (allow/deny/hold, audited, one-URL). It intentionally seeds `connected_tools` rows directly (no CRUD UI yet) and defers the security hardenings — both are the next plans. Ship Plan 2 (security) before any real customer.
