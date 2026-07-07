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
