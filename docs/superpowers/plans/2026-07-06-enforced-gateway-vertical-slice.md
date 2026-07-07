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
  - `class Downstream` constructed from a config dict `{name, transport, target, auth}`, with `name` property and two **per-call** async methods: `async def list_tools() -> list[types.Tool]` and `async def call(tool: str, args: dict) -> types.CallToolResult`. Each opens a fresh downstream connection, uses it, and closes it — all within the caller's own task.
  - For `stdio`, `target` is a JSON list `[command, *args]`; for `http`, `target` is a URL and `auth` (already decrypted by the caller) becomes `Authorization: Bearer <auth>`.

**Design note (why per-call, not a persistent session):** `stdio_client`/`streamablehttp_client` are anyio context managers that spawn task groups/subprocesses. A session opened in one task (e.g. an app lifespan) and used from another (a request handler) raises anyio "cancel scope entered in a different task" errors. Opening and closing the connection inside the same task that uses it sidesteps this entirely. Per-call connect costs a subprocess spawn (~200-500ms) for stdio — acceptable for Phase 1 / demo; http is cheap. Do **not** cache the session across calls.

**Env note (this machine):** the `mcp` SDK's stdio client on Windows needs the child to find the package. Tests set `cwd`/`PYTHONPATH` to the `interlock-mcp` dir and invoke the venv Python. `pytest` + `pytest-asyncio` are already installed in `.venv`. This task must also add to `pyproject.toml`:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```
so `async def test_*` run without a per-test `@pytest.mark.asyncio` marker.

- [ ] **Step 1: Write a failing test (stdio against the sample server)**

```python
# tests/test_downstream.py
import sys
from interlock.downstream import Downstream

# Launch the sample server with THIS interpreter so it's found on any machine.
def _sample_cfg():
    target = json.dumps([sys.executable, "-m", "sample_tools.server"])
    return {"name": "sample", "transport": "stdio", "target": target, "auth": None}

import json

async def test_downstream_lists_and_calls_sample_tools():
    d = Downstream(_sample_cfg())
    names = {t.name for t in await d.list_tools()}
    assert {"charge_card", "read_data"} <= names
    res = await d.call("read_data", {"query": "x"})
    assert res.content  # got a result back
    assert d.name == "sample"
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_downstream.py -q`
Expected: FAIL (`interlock.downstream` module missing). If `asyncio_mode` isn't set yet the test may report "async def not natively supported" — add the `pyproject.toml` block from the Env note above, then it should FAIL on the missing module.

- [ ] **Step 3: Implement `Downstream` (per-call sessions)**

```python
# interlock/downstream.py
"""Connect to ONE downstream MCP server (stdio or http) and list/call its tools.

Per-call connections: each method opens a fresh session, uses it, and closes it
within the caller's own task. This avoids anyio cross-task cancel-scope errors
that arise when a session opened in one task is used from another.
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from mcp import ClientSession, types
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.client.streamable_http import streamablehttp_client


class Downstream:
    def __init__(self, cfg: dict[str, Any]):
        self._cfg = cfg

    @property
    def name(self) -> str:
        return self._cfg["name"]

    @asynccontextmanager
    async def _session(self) -> AsyncIterator[ClientSession]:
        if self._cfg["transport"] == "stdio":
            parts = json.loads(self._cfg["target"])
            params = StdioServerParameters(command=parts[0], args=parts[1:])
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session
        else:  # http
            headers: dict[str, str] = {}
            auth = self._cfg.get("auth")
            if auth:
                headers["Authorization"] = f"Bearer {auth}"
            async with streamablehttp_client(self._cfg["target"], headers=headers) as (
                read, write, _,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session

    async def list_tools(self) -> list[types.Tool]:
        async with self._session() as session:
            return (await session.list_tools()).tools

    async def call(self, tool: str, args: dict[str, Any]) -> types.CallToolResult:
        async with self._session() as session:
            return await session.call_tool(tool, args)
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_downstream.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/interlock/downstream.py interlock-mcp/tests/test_downstream.py interlock-mcp/pyproject.toml
git commit -m "feat(gateway): Downstream connector (per-call stdio + http MCP clients)"
```

---

## Task 5: Gateway server — aggregate + gate (allow/deny) + audit

**Files:**
- Create: `interlock-mcp/interlock/gateway.py`
- Test: `interlock-mcp/tests/test_gateway.py`

**Interfaces:**
- Consumes: a `provider` object exposing `.engine() -> PolicyEngine` (the existing `PolicyProvider` in `server.py`; `PolicyEngine.evaluate(actor, action, resource, params) -> Decision`), an `audit` object implementing the `AuditSink` protocol from `stores.py` (`record(**entry) -> str`, `add_pending`, `get_pending`), and `Downstream` (Task 4, per-call).
- Produces:
  - `def build_gateway_server(downstreams: list[Downstream], provider, audit, actor: str = "agent:default") -> Server` — a low-level MCP `Server` (`mcp.server.lowlevel.Server`) whose `list_tools` returns the union of downstream tools (namespaced `<downstream>__<tool>`), and whose `call_tool` evaluates policy then forwards on **allow**, returns a refusal on **deny**. (Hold handled in Task 6.)
  - `def _decide(engine, actor, tool, args) -> Decision` — the pure policy step (unit-tested without any MCP wiring).
  - Action mapping: `action = <tool>` (the bare downstream tool name, not the namespaced exposed name), `params = args`, `resource = str(args.get("resource") or "*")`, `actor` = configured.

**SDK note (verify against mcp 1.28.1):** confirm the low-level `@server.call_tool()` handler's expected return type in this version — it may be `list[ContentBlock]` or a `(content, structured)` tuple. Match whatever `mcp.server.lowlevel` expects; if the signature differs from the code below, adapt the return shape (the policy/forward/refuse logic is unchanged). Keep `import mcp.types as types` for `TextContent`/`Tool`.

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
                routing[f"{d.name}__{t.name}"] = (d, t)

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
- Produces: `async def wait_for_approval(audit, decision_id, poll, timeout) -> str` returning `"approved"` or `"denied"`; plus the wired hold branch in `call_tool`.
- **Signature change:** `build_gateway_server` gains a `cfg` parameter → `build_gateway_server(downstreams, provider, audit, cfg, actor="agent:default")`. Inside, compute `hold_poll = max(1.0, cfg.poll_interval / 10)` and `hold_timeout = cfg.hold_timeout` once (closed over by `call_tool`). This threads config without reaching into `provider`'s privates.

**Note:** `audit.get_pending` is a synchronous call (httpx sync client in api mode); calling it from the async poll loop briefly blocks the event loop per poll (~once/sec). Acceptable for Phase 1's single-agent demo. If it becomes a bottleneck, wrap in `asyncio.to_thread` (out of scope now).

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

Change the `build_gateway_server` signature to accept `cfg`:
`def build_gateway_server(downstreams, provider, audit, cfg, actor="agent:default")`, and near the top of its body (before the handlers) compute the hold timings the `call_tool` closure will use:

```python
    hold_poll = max(1.0, cfg.poll_interval / 10)
    hold_timeout = cfg.hold_timeout
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
                                          poll=hold_poll, timeout=hold_timeout)
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
- Consumes: `Config` (`cfg.dashboard_url`, `cfg.auth_headers()`, `cfg.request_timeout`, `cfg.verify_tls`, and new `cfg.ep_tools`).
- Produces: `class ApiToolsStore` constructed as `ApiToolsStore(cfg)` (builds its own httpx client, self-contained so `server.py` wiring is one line) with `def get_tools(self) -> list[dict]` returning the org's connected tools (`[{name, transport, target, auth, enabled}, ...]`), last-known-good cache on failure, `[]` if never loaded.

First add to `config.py` `Config` (field + in `from_env`): `ep_tools: str` = `_env("INTERLOCK_EP_TOOLS", "/api/tools")`.

- [ ] **Step 1: Write a failing test (mock dashboard)**

```python
# tests/test_tools_config.py
import httpx
from interlock.config import Config
from interlock.tools_config import ApiToolsStore

def _cfg(monkeypatch, url):
    monkeypatch.setenv("INTERLOCK_STORE", "api")
    monkeypatch.setenv("INTERLOCK_DASHBOARD_URL", url)
    monkeypatch.setenv("INTERLOCK_API_KEY", "sk_test")
    return Config.from_env()

def test_get_tools_returns_list_and_caches(monkeypatch):
    calls = {"n": 0}
    def handler(request):
        calls["n"] += 1
        assert request.headers.get("authorization") == "Bearer sk_test"
        return httpx.Response(200, json={"tools": [
            {"name": "sample", "transport": "stdio", "target": "[]",
             "auth": None, "enabled": True}]})
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiToolsStore(cfg, transport=httpx.MockTransport(handler))
    tools = store.get_tools()
    assert tools[0]["name"] == "sample"

def test_get_tools_empty_when_unreachable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("down")
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiToolsStore(cfg, transport=httpx.MockTransport(handler))
    assert store.get_tools() == []   # never-loaded -> empty, never raises
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_tools_config.py -q`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `ApiToolsStore`**

```python
# interlock/tools_config.py
"""Loads the org's connected downstream tools from the dashboard (GET /api/tools).

Mirrors ApiPolicyStore: caches last-known-good; on any failure returns the cache,
or [] if nothing has ever loaded. Never raises to the caller and never fails open.
"""
from __future__ import annotations

import threading
from typing import Any

import httpx

from .config import Config


class ApiToolsStore:
    def __init__(self, cfg: Config, transport: httpx.BaseTransport | None = None):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.dashboard_url,
            headers=cfg.auth_headers(),
            timeout=cfg.request_timeout,
            verify=cfg.verify_tls,
            transport=transport,  # None in prod; MockTransport in tests
        )
        self._cache: list[dict[str, Any]] | None = None
        self._lock = threading.Lock()

    def get_tools(self) -> list[dict[str, Any]]:
        try:
            r = self._client.get(self._cfg.ep_tools)
            r.raise_for_status()
            tools = r.json().get("tools", [])
            with self._lock:
                self._cache = tools
            return tools
        except Exception:
            with self._lock:
                return self._cache if self._cache is not None else []
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_tools_config.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add interlock-mcp/interlock/tools_config.py interlock-mcp/interlock/config.py interlock-mcp/tests/test_tools_config.py
git commit -m "feat(gateway): load connected-tools config from the dashboard (/api/tools)"
```

---

## Task 8: Serve the gateway as its own app (`INTERLOCK_MODE=gateway`)

**Files:**
- Modify: `interlock-mcp/interlock/gateway.py` (add `build_gateway_app`)
- Modify: `interlock-mcp/interlock/server.py` (factor `_token_gate`, add `_build_gateway_http_app`, wire `main`)
- Test: `interlock-mcp/tests/test_gateway_app.py`

**Interfaces:**
- Consumes: `build_gateway_server` (Task 5/6), `Downstream` (Task 4), `ApiToolsStore` (Task 7), the module-level `policies` (a `PolicyProvider`) and `audit` (an `AuditSink`) already built in `server.py`, and `StreamableHTTPSessionManager` from `mcp.server.streamable_http_manager`.
- Produces:
  - `gateway.build_gateway_app(downstreams, provider, audit, cfg) -> Starlette` — an ASGI app serving the gateway MCP server over streamable-HTTP at path `/gw`, with a lifespan that runs the session manager.
  - `server._token_gate(app)` — factored from the existing `_build_http_app` gate (token via `?key=`/`token=` query or `Authorization: Bearer`, constant-time compare, 401 otherwise; pass-through when no token set). `_build_http_app` is refactored to call it.
  - `server._build_gateway_http_app()` — loads connected tools via `ApiToolsStore`, builds `Downstream`s, wraps `build_gateway_app(...)` in `_token_gate`.
  - `main()` selects the app by `INTERLOCK_MODE` (`gateway` → gateway app; anything else → the existing checkpoint app). Same uvicorn bind.

**Design decision (standalone app, not co-mounted):** the gateway runs as a *mode* of the same service/image via `INTERLOCK_MODE=gateway`, on its own process/port — NOT co-mounted with the `/mcp` checkpoint in one app. Co-mounting two `StreamableHTTPSessionManager`s under one ASGI app means running two independent session-manager lifespans and is fragile; a single-purpose app per process is simpler and robust. The connect URL is `https://<gateway-host>/gw?key=<token>`. Connected tools are loaded at startup (add the `connected_tools` row, then start the gateway); hot-add of a new downstream needs a restart — acceptable for Phase 1.

- [ ] **Step 1: Write failing tests**

```python
# tests/test_gateway_app.py
import httpx
from starlette.routing import Mount
from interlock.gateway import build_gateway_app


class _Cfg:  # minimal cfg stand-in
    poll_interval = 30
    hold_timeout = 300


def test_gateway_app_mounts_gw():
    app = build_gateway_app([], provider=None, audit=None, cfg=_Cfg())
    assert any(isinstance(r, Mount) and r.path == "/gw" for r in app.routes)


async def test_token_gate_rejects_without_key():
    from interlock import server
    # Wrap a trivial ASGI app so we test the gate, not the gateway internals.
    async def ok(scope, receive, send):
        await send({"type": "http.response.start", "status": 200,
                    "headers": [(b"content-type", b"text/plain")]})
        await send({"type": "http.response.body", "body": b"ok"})

    import os
    os.environ["INTERLOCK_MCP_AUTH_TOKEN"] = "secret-t"
    gated = server._token_gate(ok)
    transport = httpx.ASGITransport(app=gated)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        assert (await c.get("/gw")).status_code == 401              # no key
        assert (await c.get("/gw?key=secret-t")).status_code == 200  # good key
    del os.environ["INTERLOCK_MCP_AUTH_TOKEN"]
```

- [ ] **Step 2: Run it, verify it fails**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway_app.py -q`
Expected: FAIL (`build_gateway_app` / `_token_gate` missing).

- [ ] **Step 3: Add `build_gateway_app` to `gateway.py`**

```python
# add to interlock/gateway.py
import contextlib

from starlette.applications import Starlette
from starlette.routing import Mount
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager


def build_gateway_app(downstreams, provider, audit, cfg) -> Starlette:
    """ASGI app serving the gateway MCP server over streamable-HTTP at /gw."""
    server = build_gateway_server(downstreams, provider, audit, cfg)
    session_manager = StreamableHTTPSessionManager(app=server)

    async def handle_gw(scope, receive, send):
        await session_manager.handle_request(scope, receive, send)

    @contextlib.asynccontextmanager
    async def lifespan(app):
        async with session_manager.run():
            yield

    return Starlette(routes=[Mount("/gw", app=handle_gw)], lifespan=lifespan)
```

- [ ] **Step 4: Factor `_token_gate` + add `_build_gateway_http_app` in `server.py`**

Extract the existing gate logic from `_build_http_app` into a reusable `_token_gate(app)` (the exact `gated` closure already in `_build_http_app` — move it, and have `_build_http_app` return `_token_gate(mcp.streamable_http_app())`). Then add:

```python
def _build_gateway_http_app():
    """The enforced-gateway app (INTERLOCK_MODE=gateway), token-gated."""
    from .tools_config import ApiToolsStore
    from .downstream import Downstream
    from .gateway import build_gateway_app

    tools = ApiToolsStore(cfg).get_tools()
    downstreams = [Downstream(t) for t in tools]
    return _token_gate(build_gateway_app(downstreams, policies, audit, cfg))
```

In `main()`, select the app:

```python
        mode = os.environ.get("INTERLOCK_MODE", "checkpoint").lower()
        app = _build_gateway_http_app() if mode == "gateway" else _build_http_app()
        uvicorn.run(app, host=host, port=port)
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `./.venv/Scripts/python.exe -m pytest tests/test_gateway_app.py -q`
Expected: PASS. Also run the full suite: `./.venv/Scripts/python.exe -m pytest -q` → all green.

- [ ] **Step 6: Commit**

```bash
git add interlock-mcp/interlock/gateway.py interlock-mcp/interlock/server.py interlock-mcp/tests/test_gateway_app.py
git commit -m "feat(gateway): standalone gateway app served at /gw via INTERLOCK_MODE=gateway"
```

---

## Task 9: End-to-end verify (`verify-gateway.mjs`)

**Files:**
- Create: `dashboard/scripts/verify-gateway.mjs` + a small Python client `interlock-mcp/gateway_e2e.py`

**Interfaces:**
- Produces: a test that seeds (against live Supabase, service role) an org + api key + policies (allow `read_data`, deny `delete_records`, require_approval `charge_card`) + one `connected_tools` row (stdio → sample server via `[sys.executable, "-m", "sample_tools.server"]`), starts the gateway locally with `INTERLOCK_MODE=gateway INTERLOCK_STORE=api`, drives an MCP client at `http://localhost:<port>/gw?key=<token>`, and asserts: `sample__read_data`→result JSON with `performed:true`; `sample__delete_records`→`blocked_by:"stileai"`; `sample__charge_card`→held, then approved out-of-band → forwarded result `performed:true`. Confirms audit rows for the org via `/api/audit`. Cleans up all seeded rows.

**Prereq:** this task requires the `connected_tools` table applied (Task 1) and the dashboard running (Vercel prod or local `npm run dev`). The controller will confirm the migration is applied before this task runs.

- [ ] **Step 1:** Write `interlock-mcp/gateway_e2e.py` — `truststore.inject_into_ssl()`, a streamablehttp client to `/gw?key=<token>`; call the three namespaced tools; for the charge, `asyncio.create_task` that waits ~1.5s then POSTs the dashboard `POST /api/approvals/{decision_id}/resolve` (api-key auth, body `{"approver":"e2e","approved":true}`) to approve it; assert the three outcomes. The `decision_id` for the held charge is read from the pending list via `GET /api/approvals?status=pending` (api-key auth) — or parsed from the gateway's pending response if surfaced.
- [ ] **Step 2:** Write `dashboard/scripts/verify-gateway.mjs` to seed org/key/policies/connected_tools (service role, mirror `scripts/verify-api.mjs` / `phase9_*`), spawn the gateway process (`INTERLOCK_MODE=gateway`, env with the seeded key + a test token + `INTERLOCK_DASHBOARD_URL`), run `gateway_e2e.py`, assert its exit 0, then delete all seeded rows.
- [ ] **Step 3:** Run end-to-end; expected: `GATEWAY E2E: ALL CHECKS PASSED` and audit rows present. If live-infra flakiness blocks it, capture the failure and report DONE_WITH_CONCERNS rather than weakening asserts.
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
- **Type consistency:** `_decide(engine, actor, tool, args)`, `wait_for_approval(audit, decision_id, poll, timeout)`, `build_gateway_server(downstreams, provider, audit, cfg, actor=...)`, `build_gateway_app(downstreams, provider, audit, cfg)`, `Downstream.{name, list_tools, call}` (per-call), `ApiToolsStore(cfg).get_tools()`, `_token_gate(app)`, `resolveOrgId`, `/api/tools` shape `{tools:[{name,transport,target,auth,enabled}]}` — used consistently across tasks. Signature evolution: `build_gateway_server` gains `cfg` in Task 6 (declared there); Task 8 is its first caller.

---

## Execution note

This plan produces a **working, demoable gateway** (allow/deny/hold, audited, one-URL). It intentionally seeds `connected_tools` rows directly (no CRUD UI yet) and defers the security hardenings — both are the next plans. Ship Plan 2 (security) before any real customer.
