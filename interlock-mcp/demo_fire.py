"""Fire a few real request_action calls through the LIVE checkpoint, as an agent
would. Whatever decisions come back land in the dashboard's audit log + approvals."""
import asyncio
import json
import os

import truststore

truststore.inject_into_ssl()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = os.environ["MCP_URL"]
TOKEN = os.environ["MCP_TOKEN"]

SCENARIOS = [
    ("agent:support-bot", "customer.read", "customer:1024", {}),
    ("agent:support-bot", "db.drop_table", "table:customers", {}),
    ("agent:billing-bot", "payment.charge", "customer:1024", {"amount": 4200, "card_number": "4111111111111111"}),
    ("agent:sales-bot", "email.send", "email:lead@acme.com", {"to": "lead@acme.com", "subject": "Hi"}),
]


def _payload(result):
    for b in result.content:
        t = getattr(b, "text", None)
        if t:
            try:
                return json.loads(t)
            except json.JSONDecodeError:
                return t
    return None


async def main():
    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            print("connected to your live checkpoint\n")
            for actor, action, resource, params in SCENARIOS:
                d = _payload(await s.call_tool("request_action", {
                    "actor": actor, "action": action, "resource": resource, "params": params,
                }))
                effect = d.get("effect", "?")
                mark = {"allow": "PASS ", "deny": "BLOCK", "require_approval": "HOLD "}.get(effect, effect)
                print(f"  [{mark}] {actor}  {action}  ->  {effect}")
                print(f"          {d.get('reason','')}")


asyncio.run(main())
