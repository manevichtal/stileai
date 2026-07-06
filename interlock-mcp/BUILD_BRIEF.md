# Build Brief — Interlock MCP with dashboard control

**Give this file to Claude (Claude Code or a new chat) together with `interlock-mcp.zip`.**
It describes how to extend the existing working prototype so an admin manages
everything from a web dashboard.

---

## Context for Claude

Attached (`interlock-mcp.zip`) is a working MCP server called **Interlock**: a
policy + audit checkpoint for agentic AI. An agent calls `request_action` before
a sensitive operation; Interlock evaluates it against policy rules and returns
allow / deny / require_approval, logging every decision. It runs on the official
MCP Python SDK (`mcp`, v1.x), currently over stdio locally.

Today its policies live in a local `policies.yaml` and its audit log is a local
JSONL file. **Your job is to make an external dashboard the source of truth and
control plane**, without rewriting the policy engine (`interlock/engine.py`),
which already accepts policies as plain data.

## Goal

An **admin** uses a web **dashboard** to:
1. Create / edit / delete / reorder policy rules (no file editing, no restarts).
2. View the audit trail of every decision the MCP made.
3. See and resolve pending approvals (approve / reject).

The **MCP server** must:
- Pull its active policies from the dashboard's source of truth (not the file).
- Reflect policy changes quickly (poll on an interval and/or refresh on demand).
- Push every decision to the shared audit store.
- Register pending approvals where the dashboard can see and resolve them.

## Required change: introduce a pluggable "store" layer

Do **not** hard-code the file. Add an interface the rest of the code depends on:

```python
class PolicyStore:
    def get_policies(self) -> dict: ...        # returns the policies dict engine expects

class AuditSink:
    def record(self, entry: dict) -> str: ...  # persist one decision, return id
    def add_pending(self, pending: dict) -> None: ...
    def get_pending(self, decision_id: str): ...
    def list_pending(self) -> list: ...
    def resolve(self, decision_id, approver, approved, note): ...
    def read_log(self, limit, actor=None, effect=None) -> list: ...
```

Provide these implementations, selected by an env var (`INTERLOCK_STORE`):
- `file`  — the current local behavior (keep it; good for local dev/testing).
- **`api`** — talks to the dashboard's HTTP API (see integration section).
- `db`    — talks directly to a shared database (if we go the DB route).

The engine and MCP tools stay unchanged; they just call the store interface.

## Dashboard integration (FILL THIS IN)

> These are the details that determine the exact code. If unknown, ask me, or
> default to the "api" store with the endpoint shapes below and I'll adjust.

- Dashboard URL: `__________________________`
- Does it already exist, or should you build it too? `__________________________`
- Dashboard stack / backend: `__________________________`
- Auth method between MCP and dashboard (API key / OAuth / JWT): `__________________________`
- Source of truth for policies (dashboard API / shared Postgres / other): `__________________________`

### Expected API contract (if using the `api` store)

If the dashboard exposes a REST API, implement the `api` store against these
(adjust names to match the real dashboard). All requests carry an auth token.

```
GET  /api/policies                 -> { default_effect, default_reason, policies:[...] }
GET  /api/policies/version         -> { version: "<etag-or-timestamp>" }   # cheap poll
POST /api/audit                    <- one decision entry (fire-and-forget ok)
GET  /api/audit?limit=&actor=&effect=  -> [ entries ]
POST /api/approvals                <- register a pending decision
GET  /api/approvals?status=pending -> [ pending ]
POST /api/approvals/{id}/resolve   <- { approver, approved, note }
```

The policy JSON shape is exactly what `interlock/engine.load_policies_from_dict`
consumes today (see `policies.yaml` for the fields: id, effect, priority, actor,
action, resource, conditions, approvals_required). Keep that shape so the engine
needs no changes.

### Policy refresh strategy

- Poll `GET /api/policies/version` every N seconds (default 30, env-configurable);
  refetch full policies only when the version changes. Cache in memory.
- Also keep the existing `reload_policies` MCP tool for on-demand refresh.
- If the dashboard is unreachable, keep serving the last-known-good policies and
  log a warning — never fail open to "allow".

## Hosting

- MCP runs as a hosted service over streamable-HTTP (`INTERLOCK_TRANSPORT=http`),
  deployable to Railway / Render / Fly.io / a VPS or Docker.
- Add authentication on the MCP endpoint before exposing it (the SDK supports
  OAuth/JWT bearer tokens).
- Requirements: state (audit + pending) must live in the shared store, not memory,
  so multiple instances and restarts behave correctly.

## Acceptance criteria

1. Admin edits a policy in the dashboard; within the poll interval the MCP's next
   decision reflects it — no restart.
2. Every `request_action` (and every guarded tool call) appears in the dashboard's
   audit view, with sensitive params redacted.
3. A `require_approval` decision shows up in the dashboard's approvals queue and
   can be approved/rejected there; the agent's `check_status` reflects the result.
4. If the dashboard is down, the MCP keeps enforcing the last-known policies and
   never defaults to allow.
5. `INTERLOCK_STORE=file` still works for local development with no dashboard.

## Keep intact

- `interlock/engine.py` policy semantics (first-match-by-priority, glob matching,
  safe structured conditions, fail-safe default).
- Redaction of sensitive parameters before anything is persisted.
- The existing MCP tool names and their return shapes where possible.
- `selftest.py` should still pass against the `file` store.
```
