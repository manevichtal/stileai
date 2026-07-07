# interlock/gateway.py
from __future__ import annotations
import asyncio
import contextlib
import json
import time
from typing import Any

import mcp.types as types
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.routing import Mount

from .audit import PendingDecision
from .engine import Decision, Effect, PolicyEngine


async def wait_for_approval(audit, decision_id: str, poll: float, timeout: float) -> str:
    """Poll `audit.get_pending(decision_id).status` until it leaves "pending".

    Returns "approved" or "denied". A timeout (or a pending record that never
    resolves) returns "denied" — fail-safe: silence from a human is not consent.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        p = audit.get_pending(decision_id)
        if p is not None and getattr(p, "status", "pending") != "pending":
            return "approved" if p.status == "approved" else "denied"
        await asyncio.sleep(poll)
    return "denied"


def _decide(engine: PolicyEngine, actor: str, action: str, resource: str, params: dict[str, Any]) -> Decision:
    # `resource` must be caller-derived (downstream identity + tool name), never taken
    # from agent-supplied args: the agent is untrusted and can spoof an `args["resource"]`
    # value to dodge resource-scoped policies while the real tool acts on other args
    # (e.g. `table`). Arg-based scoping belongs in policy `conditions` over the real
    # tool params, since those are the args the tool actually consumes.
    return engine.evaluate(actor, action, resource, params)


def build_gateway_server(downstreams, provider, audit, cfg, actor: str = "agent:default") -> Server:
    # map exposed tool name -> (downstream, real tool name)
    routing: dict[str, tuple[Any, str]] = {}
    server = Server("stileai-gateway")
    hold_poll = max(1.0, cfg.poll_interval / 10)
    hold_timeout = cfg.hold_timeout

    async def _forward(d, real: str, args: dict[str, Any], *, decision_id: str,
                       resource: str) -> list[types.ContentBlock]:
        """Call the downstream tool; on failure, record a follow-up audit entry
        (same decision_id, status="error") and return a generic envelope — the
        raw exception text is never handed back to the agent (error hygiene)."""
        try:
            res = await d.call(real, args)
            return list(res.content)
        except Exception as exc:
            audit.record(actor=actor, action=real, resource=resource, params=args,
                        effect="error", matched_policy=None, reason=str(exc),
                        status="error", decision_id=decision_id)
            return [types.TextContent(type="text",
                    text=json.dumps({"performed": False, "error": "downstream call failed",
                                     "decision_id": decision_id}))]

    async def _refresh_routing():
        routing.clear()
        for d in downstreams:
            try:
                tools = await d.list_tools()
            except Exception:
                # Isolate per-downstream failures: an unreachable downstream is skipped
                # (its tools simply don't appear) rather than blanking routing for
                # everyone. This does not fail open — the agent can't call what isn't
                # routed.
                continue
            for t in tools:
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
            return [types.TextContent(type="text",
                    text=json.dumps({"performed": False, "blocked_by": "stileai",
                                     "reason": f"unknown tool {name}"}))]
        d, tool = entry
        real = tool.name
        # Trustworthy resource: derived from the gateway's own routing (downstream
        # identity + real tool name), not from agent-controlled `args`. See _decide.
        resource = f"{d.name}:{real}"
        decision = _decide(provider.engine(), actor, real, resource, args)
        status = {Effect.ALLOW: "allowed", Effect.DENY: "denied",
                  Effect.REQUIRE_APPROVAL: "pending"}[decision.effect]
        decision_id = audit.record(actor=actor, action=real, resource=resource,
                                   params=args, effect=decision.effect.value,
                                   matched_policy=decision.matched_policy, reason=decision.reason,
                                   status=status)
        if decision.effect == Effect.ALLOW:
            return await _forward(d, real, args, decision_id=decision_id, resource=resource)
        if decision.effect == Effect.DENY:
            return [types.TextContent(type="text",
                    text=json.dumps({"performed": False, "blocked_by": "stileai",
                                     "reason": decision.reason}))]
        # REQUIRE_APPROVAL: create the pending approval and wait for a human.
        audit.add_pending(PendingDecision(
            decision_id=decision_id, actor=actor, action=real,
            resource=resource, params=args, reason=decision.reason,
            matched_policy=decision.matched_policy,
            approvals_required=decision.approvals_required))
        outcome = await wait_for_approval(audit, decision_id,
                                          poll=hold_poll, timeout=hold_timeout)
        if outcome == "approved":
            return await _forward(d, real, args, decision_id=decision_id, resource=resource)
        return [types.TextContent(type="text",
                text=json.dumps({"performed": False, "blocked_by": "stileai",
                                 "reason": "not approved", "decision_id": decision_id}))]

    return server


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
