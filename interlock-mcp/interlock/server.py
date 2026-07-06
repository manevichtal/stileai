"""
Interlock — the checkpoint for agentic AI, as an MCP server.

Interlock sits between an AI agent and the systems it can touch. Before an agent
performs a sensitive action it calls `request_action`; Interlock evaluates the
action against your policies and returns ALLOW / DENY / REQUIRE_APPROVAL, logging
every decision. Decisions that need a human are resolved with `submit_approval`.

Where policies and audit data live is pluggable (INTERLOCK_STORE):
  file  - local policies.yaml + local JSONL audit log (dev / offline).
  api   - the dashboard's HTTP API is the source of truth (production). Policies
          are pulled from the dashboard; audit entries + pending approvals are
          pushed back to it. An admin manages everything from the dashboard.

Run locally (stdio, for Claude Desktop):   python -m interlock.server
Run for cloud (HTTP):                       INTERLOCK_TRANSPORT=http python -m interlock.server
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from .audit import PendingDecision
from .config import Config
from .engine import Effect, PolicyEngine, load_policies_from_dict
from .stores import build_stores

cfg = Config.from_env()

# Streamable-HTTP DNS-rebinding protection. The MCP transport otherwise only
# allows localhost Host headers, which 421s ("Invalid Host header") any hosted
# deployment reached via its public domain. Behind a proxy and our own
# bearer-token gate: pin to explicit hosts if INTERLOCK_MCP_ALLOWED_HOSTS is set,
# otherwise disable host pinning (the token is the real access control).
_allowed_hosts = [
    h.strip() for h in os.environ.get("INTERLOCK_MCP_ALLOWED_HOSTS", "").split(",") if h.strip()
]
if _allowed_hosts:
    _transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=_allowed_hosts,
        allowed_origins=_allowed_hosts,
    )
else:
    _transport_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)

mcp = FastMCP("interlock", transport_security=_transport_security)
policy_store, audit = build_stores(cfg)


class PolicyProvider:
    """Holds the live engine and refreshes it from the policy store.

    Refresh is lazy and time-bounded: at most once per poll interval, checked at
    the start of each evaluation. This avoids a background thread while keeping
    the MCP in sync with dashboard edits within `poll_interval` seconds.

    Fail-safe: if the store can't be reached and we have never loaded a ruleset,
    we serve an engine whose default effect is `unavailable_effect` (deny by
    default) so the checkpoint NEVER silently allows while the control plane is
    down.
    """

    def __init__(self, store, config: Config):
        self._store = store
        self._cfg = config
        self._engine: PolicyEngine | None = None
        self._version: str | None = None
        self._last_check = 0.0
        self._lock = threading.Lock()
        self._degraded = False
        self._load(force=True)

    def _build_failsafe(self) -> PolicyEngine:
        effect = {
            "allow": Effect.ALLOW,
            "deny": Effect.DENY,
            "require_approval": Effect.REQUIRE_APPROVAL,
        }.get(self._cfg.unavailable_effect, Effect.DENY)
        return PolicyEngine(
            [], default_effect=effect,
            default_reason="Control plane (dashboard) unreachable — fail-safe "
                           f"default '{effect.value}' applied.",
        )

    def _load(self, force: bool = False) -> None:
        try:
            version = self._store.version()
            if not force and version == self._version and self._engine is not None:
                return
            data = self._store.get_policies()
            with self._lock:
                self._engine = load_policies_from_dict(data)
                self._version = version
                self._degraded = False
        except Exception:
            with self._lock:
                if self._engine is None:
                    self._engine = self._build_failsafe()
                    self._degraded = True
                # else: keep last-known-good engine

    def _maybe_refresh(self) -> None:
        now = time.monotonic()
        if now - self._last_check >= self._cfg.poll_interval:
            self._last_check = now
            self._load(force=False)

    def engine(self) -> PolicyEngine:
        self._maybe_refresh()
        with self._lock:
            return self._engine  # type: ignore[return-value]

    def reload(self) -> dict[str, Any]:
        self._last_check = time.monotonic()
        self._load(force=True)
        with self._lock:
            return {
                "ok": not self._degraded,
                "degraded": self._degraded,
                "version": self._version,
                "policy_count": len(self._engine.policies) if self._engine else 0,
            }


policies = PolicyProvider(policy_store, cfg)


def _evaluate_and_log(actor: str, action: str, resource: str,
                      params: dict[str, Any]) -> dict[str, Any]:
    """Shared path used by request_action and every guarded tool."""
    decision = policies.engine().evaluate(actor, action, resource, params)
    status = {
        Effect.ALLOW: "allowed",
        Effect.DENY: "denied",
        Effect.REQUIRE_APPROVAL: "pending",
    }[decision.effect]

    decision_id = audit.record(
        actor=actor, action=action, resource=resource, params=params,
        effect=decision.effect.value, matched_policy=decision.matched_policy,
        reason=decision.reason, status=status,
    )

    if decision.effect == Effect.REQUIRE_APPROVAL:
        audit.add_pending(PendingDecision(
            decision_id=decision_id, actor=actor, action=action,
            resource=resource, params=params, reason=decision.reason,
            matched_policy=decision.matched_policy,
            approvals_required=decision.approvals_required,
        ))

    return {
        "decision_id": decision_id,
        "effect": decision.effect.value,
        "allowed": decision.effect == Effect.ALLOW,
        "status": status,
        "matched_policy": decision.matched_policy,
        "reason": decision.reason,
        "approvals_required": decision.approvals_required,
    }


# --- checkpoint tools --------------------------------------------------------

@mcp.tool()
def request_action(actor: str, action: str, resource: str = "*",
                   params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Ask Interlock whether an action is permitted, before performing it.

    Call this first for any sensitive operation. Returns a decision:
    - effect "allow": proceed.
    - effect "deny": do not proceed; tell the user why (see `reason`).
    - effect "require_approval": pause; a human must approve (in the dashboard,
      or via submit_approval) using the returned decision_id before you continue.
      Poll check_status for the outcome.

    Args:
        actor: who is asking, e.g. "agent:support-bot" or "user:alice".
        action: the verb, e.g. "email.send", "db.delete", "payment.charge".
        resource: what it touches, e.g. "customer:1234" or "table:orders".
        params: extra detail policies may inspect, e.g. {"amount": 5000}.
    """
    return _evaluate_and_log(actor, action, resource, params or {})


@mcp.tool()
def submit_approval(decision_id: str, approver: str, approved: bool,
                    note: str = "") -> dict[str, Any]:
    """Resolve a REQUIRE_APPROVAL decision (human-in-the-loop).

    Records one approver's vote. If `approved` is false the decision is denied.
    If true and the required number of approvals is reached, it becomes approved
    and the action may proceed. (Admins can also do this from the dashboard.)
    """
    pending = audit.resolve(decision_id, approver, approved, note)
    if pending is None:
        return {"error": "unknown decision_id", "decision_id": decision_id}

    audit.record(
        actor=pending.actor, action=pending.action, resource=pending.resource,
        params=pending.params, effect="require_approval",
        matched_policy=pending.matched_policy,
        reason=f"approval vote by {approver}: "
               f"{'approved' if approved else 'denied'}"
               f"{f' — {note}' if note else ''}",
        status=pending.status, decision_id=decision_id,
    )
    return pending.to_public()


@mcp.tool()
def check_status(decision_id: str) -> dict[str, Any]:
    """Look up the current status of a decision awaiting or past approval."""
    pending = audit.get_pending(decision_id)
    if pending is None:
        return {"error": "unknown or non-pending decision_id",
                "decision_id": decision_id}
    return pending.to_public()


@mcp.tool()
def list_pending() -> list[dict[str, Any]]:
    """List all decisions currently awaiting human approval."""
    return [p.to_public() for p in audit.list_pending()]


@mcp.tool()
def get_audit_log(limit: int = 50, actor: str | None = None,
                  effect: str | None = None) -> list[dict[str, Any]]:
    """Read recent entries from the audit trail (newest last).

    Optionally filter by `actor` or by `effect` (allow / deny / require_approval).
    """
    return audit.read_log(limit=limit, actor=actor, effect=effect)


@mcp.tool()
def list_policies() -> list[dict[str, Any]]:
    """Show the active policy rules, in evaluation order."""
    out = []
    for p in policies.engine().policies:
        out.append({
            "id": p.id, "effect": p.effect.value, "priority": p.priority,
            "actor": p.actor, "action": p.action, "resource": p.resource,
            "conditions": [
                {"field": c.field, "op": c.op, "value": c.value}
                for c in p.conditions
            ],
            "description": p.description,
        })
    return out


@mcp.tool()
def reload_policies() -> dict[str, Any]:
    """Refresh policy rules from the source of truth (dashboard or file) now."""
    return policies.reload()


# --- guarded example tools (pattern #2) --------------------------------------

@mcp.tool()
def guarded_send_email(actor: str, to: str, subject: str,
                       body: str = "") -> dict[str, Any]:
    """Example of a tool that self-gates: it only 'sends' if policy allows.

    Demonstrates wrapping a real side effect. Replace the marked section with a
    real email call. Denied or approval-pending requests never reach that code.
    """
    resource = f"email:{to}"
    params = {"to": to, "subject": subject, "body_len": len(body)}
    gate = _evaluate_and_log(actor, "email.send", resource, params)
    if not gate["allowed"]:
        return {"performed": False, "gate": gate}

    # >>> real side effect would go here (e.g. SMTP / provider API) <<<
    return {"performed": True, "gate": gate,
            "detail": f"(demo) email to {to} would be sent"}


@mcp.tool()
def guarded_delete_record(actor: str, table: str, record_id: str
                          ) -> dict[str, Any]:
    """Example guarded destructive action. Only deletes if policy allows."""
    resource = f"{table}:{record_id}"
    params = {"table": table, "record_id": record_id}
    gate = _evaluate_and_log(actor, "db.delete", resource, params)
    if not gate["allowed"]:
        return {"performed": False, "gate": gate}

    # >>> real deletion would go here <<<
    return {"performed": True, "gate": gate,
            "detail": f"(demo) {resource} would be deleted"}


# --- entrypoint --------------------------------------------------------------

def _build_http_app():
    """Build the streamable-HTTP ASGI app, gated by a shared bearer token.

    When INTERLOCK_MCP_AUTH_TOKEN is set, every HTTP request must present
    `Authorization: Bearer <token>` (constant-time compared). This is the caller
    authentication the README calls for before exposing the server publicly —
    without it, anyone who finds the URL could approve decisions or read the
    audit log. If the token is unset (e.g. local stdio dev), no gate is added.

    Implemented as PURE ASGI middleware (not BaseHTTPMiddleware) so it never
    buffers the transport's streaming/SSE responses — wrapping those in
    BaseHTTPMiddleware corrupts the stream (proxies then return 421).
    """
    import hmac
    import os

    app = mcp.streamable_http_app()
    token = os.environ.get("INTERLOCK_MCP_AUTH_TOKEN", "").strip()
    if not token:
        return app

    async def gated(scope, receive, send):
        if scope.get("type") == "http":
            headers = dict(scope.get("headers") or [])
            auth = headers.get(b"authorization", b"").decode("latin-1")
            provided = auth[7:].strip() if auth[:7].lower() == "bearer " else auth.strip()
            if not (provided and hmac.compare_digest(provided, token)):
                await send({
                    "type": "http.response.start",
                    "status": 401,
                    "headers": [(b"content-type", b"application/json")],
                })
                await send({
                    "type": "http.response.body",
                    "body": b'{"error":"unauthorized"}',
                })
                return
        # non-http scopes (lifespan/websocket) and authenticated http pass through
        await app(scope, receive, send)

    return gated


def main() -> None:
    if cfg.transport in ("http", "streamable-http", "streamable_http"):
        # Bind to the host/port the hosting platform provides. Render, Railway,
        # and Fly.io inject $PORT and expect the service to listen on 0.0.0.0.
        # (This only affects where the HTTP server binds — not policy logic.)
        import os

        import uvicorn

        host = os.environ.get("HOST", "0.0.0.0")
        port = int(os.environ.get("PORT", str(mcp.settings.port)))
        uvicorn.run(_build_http_app(), host=host, port=port)
    else:
        mcp.run()  # stdio (default) — used by Claude Desktop


if __name__ == "__main__":
    main()
