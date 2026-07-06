"""Phase 9: demonstrate the human-in-the-loop approval on the LIVE stack.

Finds the pending large-payment decision via the live checkpoint, approves it
(as an admin would from the dashboard), and confirms the agent now sees it
approved via check_status.
"""
import asyncio
import json
import os

import truststore

truststore.inject_into_ssl()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = os.environ["MCP_URL"]
TOKEN = os.environ["MCP_TOKEN"]


def _one(result):
    for b in result.content:
        t = getattr(b, "text", None)
        if t:
            try:
                return json.loads(t)
            except json.JSONDecodeError:
                return t
    return None


def _list(result):
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict) and isinstance(sc.get("result"), list):
        return sc["result"]
    return []


async def main():
    async with streamablehttp_client(URL, headers={"Authorization": f"Bearer {TOKEN}"}) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            pend = _list(await s.call_tool("list_pending", {}))
            target = next((p for p in pend if p.get("action") == "payment.charge"), None)
            if not target:
                print("  BAD no pending payment to approve"); return 1
            did = target["decision_id"]
            print(f"  OK  found pending decision {did[:12]}… ({target.get('action')})")

            approved = _one(await s.call_tool("submit_approval", {
                "decision_id": did, "approver": "user:manevichtal@gmail.com",
                "approved": True, "note": "approved via live e2e test",
            }))
            print(f"  OK  submitted approval -> status: {approved.get('status')}")

            status = _one(await s.call_tool("check_status", {"decision_id": did}))
            if status.get("status") == "approved":
                print("  OK  check_status now reports APPROVED (agent sees the human decision)")
                print("\nPHASE 9 APPROVAL LOOP: PASSED")
                return 0
            print("  BAD check_status:", json.dumps(status)); return 1


raise SystemExit(asyncio.run(main()))
