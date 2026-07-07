# StileAI Gateway — Policy Enrichment Layer — Design Spec

_Date: 2026-07-06 · Status: design, pre-plan · Depends on: the enforced gateway (Plan 1, merged/live-proven)_

## 1. Goal

Make the "context" and "velocity" policies in the library (Bucket B) actually
enforce. Today the engine matches a policy condition only against fields the
tool call already carries, so rules like "max $5,000/day", "block DELETE with no
WHERE", or "approve email to external domains" would silently never fire. The
enrichment layer **computes those fields itself, from the real action and the
gateway's own context — never from anything the agent supplies** — and feeds
them to the policy engine at decision time.

Trust rule (non-negotiable, same principle as the gateway's resource fix): every
enriched field is derived by the gateway from the real tool arguments or the
operator's configuration. Enrichment **overwrites** any same-named key the agent
sent, so an agent can never spoof `recipient_domain`, `env`, `off_hours`, etc.

## 2. Two kinds of enriched fields

### A. Derived fields (stateless — computed in the gateway per call)

Computed in a pure `enrich()` step from the call's real args + gateway config:

| Field | Derived from | Used by policy |
|---|---|---|
| `recipient_domain` | the domain of `to` / `recipient` / `email` arg | approve-external-email / allow-internal-email |
| `recipient_count` | length of `to`/`cc`/`bcc`/`recipients` (or 1 for a single) | approve-mass-email / approve-sms-bulk |
| `has_where` | `bool(args.get("where") or args.get("filter"))` | deny-delete-no-filter |
| `env` | gateway config `INTERLOCK_ENV` (operator-set, e.g. `prod`) | approve-deploy-prod / approve-hard-delete |
| `off_hours` | gateway clock vs configured business-hours window/timezone | approve-off-hours |
| `freeze` | org change-freeze flag (gateway config `INTERLOCK_FREEZE`, later a dashboard toggle) | deny-freeze-window |

Notes: `recipient_domain` for multiple recipients evaluates against each (a rule
fires if ANY recipient is external — safest). Fields are only added when their
source is present, so unrelated tools are unaffected.

### B. Velocity counters (Supabase-backed — derived from `audit_log`)

The gateway already writes every governed call to `audit_log` (via `/api/audit`).
So recent-activity counts are read back from that same trail — no new table, no
double-counting, and the numbers are visible on the Audit page.

New endpoint **`GET /api/usage`** (API-key auth → org): returns, for the calling
org (and an `actor` param), aggregated from `audit_log`:

- `actor_action_count_1h` — count of that actor's audit rows in the last hour.
- `daily_total` — sum of `params->>'amount'` over the org's last 24h (money velocity).

The gateway calls `/api/usage` before evaluating, injects the two numbers into
the enriched params. Because the current call isn't yet in `audit_log` at
decision time, counts reflect *prior* activity — correct for a cap (the rule
that trips at "> 100" fires on the 101st action). Requires an index on
`audit_log(org_id, actor, timestamp)` for cheap counting. Fail-safe: if
`/api/usage` is unreachable, the counters are treated as unknown and the
velocity rules simply don't add extra restriction (they were the *approval*
tier; the hard denies and default-deny still apply) — never fail open.

## 3. Gateway wiring

- A new `enrichment.py`: `enrich(args, cfg, usage) -> dict` returns a NEW params
  dict = a copy of `args` with the derived fields + usage values set (overriding
  any agent-supplied same-named keys).
- In `gateway.call_tool`, before `_decide`: fetch usage (a small cached client to
  `/api/usage`), build enriched params, pass them to the engine. The **real
  downstream call still uses the original `args`** — enrichment is evaluation-only
  and never leaks synthetic fields to the tool.
- Audit records the original (redacted) args as today, plus the enriched
  decision fields in the reason/context for transparency (so an admin sees "blocked:
  recipient_domain=gmail.com").
- Config: `INTERLOCK_ENV`, `INTERLOCK_BUSINESS_HOURS` (e.g. `9-17`), `INTERLOCK_TZ`,
  `INTERLOCK_FREEZE`, `ep_usage` (`/api/usage`).

## 4. Policies unlocked (added to the library once fields exist)

New pack(s) — `velocity` + additions to comms/privacy/infra:

- approve-external-email (`recipient_domain not_in [<your-domains>]`), allow-internal-email.
- approve-mass-email (`recipient_count gt 25`), approve-sms-bulk (`recipient_count gt 10`).
- deny-delete-no-filter (`has_where eq false`).
- approve-off-hours (`off_hours eq true`) — on sensitive actions.
- approve-deploy-prod (`env eq prod`), approve-hard-delete (`env eq prod`).
- approve-daily-spend-cap (`daily_total gt 5000`), approve-high-frequency (`actor_action_count_1h gt 100`).
- deny-freeze-window (`freeze eq true`) on deploys/migrations.

**Still deferred (need the tool's cooperation or an external signal, not just
derivation):** `rows_affected` (only known after execution), `contains_pii`,
`moderation_flag`, `legal_hold`, `dnc_list`/`allowlist` membership. These require
either the downstream tool to report the value or a lookup service — a later
phase. The library will not ship rules that silently can't fire.

## 5. Security

- Enriched fields are gateway-derived and **override** agent input — no new spoof
  surface. `env`/`freeze`/business-hours are operator config, not agent data.
- `/api/usage` is API-key→org scoped like every MCP-facing route; reads only.
- Fail-safe: usage/enrichment failures never loosen a decision.

## 6. Out of scope

Tool-reported fields (`rows_affected`), PII/moderation detection, external
allow/deny lists, a dashboard freeze-toggle UI (config env first). Per-tenant
counter tables (audit-derived is sufficient and simpler).

## 7. Success criteria

1. A charge that pushes the org over $5,000/day is held for approval; under it, allowed.
2. An email to an outside domain is held; to an internal domain, allowed.
3. A `DELETE` with no `where` arg is blocked; with one, evaluated normally.
4. A deploy while `INTERLOCK_FREEZE=true` is blocked.
5. None of these fields can be spoofed by the agent (enrichment overrides agent input).
6. Counters are visible/derivable from the Audit page; usage-endpoint outage never fails open.
