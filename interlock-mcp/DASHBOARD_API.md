# Dashboard API contract

The Interlock MCP server (in `api` store mode) is a **client of your dashboard**.
Your dashboard is the source of truth: admins edit policies there, and the MCP
pulls them; the MCP pushes audit entries and pending approvals back so they show
up in the dashboard.

For that to work, your dashboard needs to expose the endpoints below. Endpoint
**paths are configurable** (see `.env.example`), so if yours differ you can map
them without code changes. All requests include your API key — by default as
`Authorization: Bearer <key>`.

If any shape here doesn't match your dashboard, tell me the real request/response
and I'll adjust the `api` store — the rest of the server won't change.

---

## 1. Policies

### `GET /api/policies`
Returns the full active ruleset. Shape is exactly what the engine consumes.

```json
{
  "default_effect": "require_approval",
  "default_reason": "No policy matched — defaulting to human approval.",
  "policies": [
    {
      "id": "approve-large-payments",
      "effect": "require_approval",
      "priority": 41,
      "actor": "*",
      "action": "payment.charge",
      "resource": "*",
      "approvals_required": 1,
      "conditions": [{ "field": "amount", "op": "gt", "value": 100 }],
      "description": "Charges over $100 require one human approval."
    }
  ]
}
```

Field reference: `effect` ∈ allow | deny | require_approval. `priority` lower =
checked first (first match wins). `actor`/`action`/`resource` use glob patterns
(`db.*`, `customer:*`, `*`). `conditions[].op` ∈ eq, ne, gt, gte, lt, lte, in,
not_in, contains, regex, exists.

### `GET /api/policies/version`
A cheap endpoint returning a value that changes whenever any policy changes
(a timestamp, incrementing integer, or etag). The MCP polls this every
`INTERLOCK_POLL_INTERVAL` seconds and only refetches `/api/policies` when it
changes — so admin edits take effect within the poll interval, no restart.

```json
{ "version": "2026-07-06T12:00:00Z" }
```

## 2. Audit

### `POST /api/audit`
The MCP posts one decision per call. Sensitive params are already redacted.
Treat as append-only; a 2xx is enough.

```json
{
  "decision_id": "a1b2c3...",
  "timestamp": "2026-07-06T12:00:00Z",
  "actor": "agent:support-bot",
  "action": "payment.charge",
  "resource": "customer:1234",
  "params": { "amount": 5000, "card_number": "***REDACTED***" },
  "effect": "require_approval",
  "matched_policy": "approve-large-payments",
  "reason": "Charges over $100 require one human approval.",
  "status": "pending"
}
```

### `GET /api/audit?limit=&actor=&effect=`
Returns recent audit rows (array of the objects above). Powers the
`get_audit_log` MCP tool. Filters are optional.

## 3. Approvals

### `POST /api/approvals`
Registers a decision awaiting human sign-off.

```json
{
  "decision_id": "a1b2c3...",
  "actor": "agent:support-bot",
  "action": "payment.charge",
  "resource": "customer:1234",
  "params": { "amount": 5000 },
  "reason": "Charges over $100 require one human approval.",
  "matched_policy": "approve-large-payments",
  "approvals_required": 1,
  "status": "pending",
  "approvals": []
}
```

### `GET /api/approvals?status=pending`
Returns the queue (array of the objects above). Powers `list_pending`.

### `GET /api/approvals/{decision_id}`
Returns one approval object. Powers `check_status`.

### `POST /api/approvals/{decision_id}/resolve`
Records an approver's vote (from the dashboard UI or the `submit_approval` tool).
Returns the updated object with `status` set to `approved` or `denied`.

```json
// request
{ "approver": "user:manager", "approved": true, "note": "verified with finance" }
```

---

## Auth

Every request carries the API key. Default header:

```
Authorization: Bearer <INTERLOCK_API_KEY>
```

For a custom scheme (e.g. `X-API-Key: <key>`), set `INTERLOCK_AUTH_HEADER=X-API-Key`
and `INTERLOCK_AUTH_SCHEME=` (empty). Your dashboard should reject requests whose
key is missing or wrong with `401`.

## Behaviour you can rely on

- The MCP **never fails open**. If the dashboard is unreachable it keeps serving
  the last policies it successfully fetched; if it has never fetched any, it
  denies everything (`INTERLOCK_UNAVAILABLE_EFFECT`, default `deny`).
- Audit/approval pushes are best-effort and won't block a decision that already
  happened, so a brief logging outage won't wedge the agent.
