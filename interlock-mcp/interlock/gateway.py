# interlock/gateway.py
from __future__ import annotations
import json
from typing import Any

import mcp.types as types
from mcp.server.lowlevel import Server

from .engine import Decision, Effect, PolicyEngine


def _decide(engine: PolicyEngine, actor: str, action: str, resource: str, params: dict[str, Any]) -> Decision:
    # `resource` must be caller-derived (downstream identity + tool name), never taken
    # from agent-supplied args: the agent is untrusted and can spoof an `args["resource"]`
    # value to dodge resource-scoped policies while the real tool acts on other args
    # (e.g. `table`). Arg-based scoping belongs in policy `conditions` over the real
    # tool params, since those are the args the tool actually consumes.
    return engine.evaluate(actor, action, resource, params)


def build_gateway_server(downstreams, provider, audit, actor: str = "agent:default") -> Server:
    # map exposed tool name -> (downstream, real tool name)
    routing: dict[str, tuple[Any, str]] = {}
    server = Server("stileai-gateway")

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
