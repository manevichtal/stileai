"""Phase 9: drive the LIVE checkpoint on Render through a real MCP session.

Connects to the deployed streamable-HTTP MCP server (with the bearer token),
calls request_action for several actions, and reads back the audit log + pending
queue through the MCP tools. Proves the deployed stack works end to end.
"""
import asyncio
import json
import os

# Use the OS trust store so TLS verifies behind this machine's corporate CA
# (test-harness only; the deployed service uses normal public TLS).
import truststore

truststore.inject_into_ssl()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = os.environ["MCP_URL"]
TOKEN = os.environ["MCP_TOKEN"]
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def _payload(result):
    # CallToolResult.content -> first text block -> parsed JSON
    for block in result.content:
        text = getattr(block, "text", None)
        if text:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
    return None


def _result_list(result):
    # List-returning tools: FastMCP puts the full list in structuredContent.result
    # and also emits one content block per item. Prefer the structured form.
    sc = getattr(result, "structuredContent", None)
    if isinstance(sc, dict) and isinstance(sc.get("result"), list):
        return sc["result"]
    out = []
    for block in getattr(result, "content", []) or []:
        text = getattr(block, "text", None)
        if not text:
            continue
        try:
            v = json.loads(text)
        except json.JSONDecodeError:
            continue
        out.extend(v) if isinstance(v, list) else out.append(v)
    return out


async def main():
    failed = False
    def ok(m): print("  OK  " + m)
    def bad(m):
        nonlocal failed
        print("  BAD " + m); failed = True

    async with streamablehttp_client(URL, headers=HEADERS) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {t.name for t in tools.tools}
            if {"request_action", "submit_approval", "get_audit_log"} <= names:
                ok(f"connected to live checkpoint; {len(names)} tools available")
            else:
                bad("expected tools missing: " + str(names))

            async def request(actor, action, resource, params):
                r = await session.call_tool("request_action", {
                    "actor": actor, "action": action, "resource": resource, "params": params,
                })
                return _payload(r)

            read_d = await request("agent:e2e-live", "customer.read", "customer:1", {})
            if read_d and read_d.get("effect") == "allow" and read_d.get("matched_policy") == "allow-reads":
                ok(f"customer.read -> allow (live policy 'allow-reads' fetched from dashboard)")
            else:
                bad("customer.read -> " + json.dumps(read_d))

            drop_d = await request("agent:e2e-live", "db.drop_table", "table:orders", {})
            if drop_d and drop_d.get("effect") == "deny" and drop_d.get("matched_policy") == "deny-prod-db-drop":
                ok("db.drop_table -> deny (live policy 'deny-prod-db-drop')")
            else:
                bad("db.drop_table -> " + json.dumps(drop_d))

            pay_d = await request("agent:e2e-live", "payment.charge", "customer:demo",
                                  {"amount": 5000, "card_number": "4111111111111111"})
            decision_id = pay_d.get("decision_id") if pay_d else None
            if pay_d and pay_d.get("effect") == "require_approval":
                ok(f"payment.charge $5000 -> require_approval (decision {decision_id[:12]}…)")
            else:
                bad("payment.charge -> " + json.dumps(pay_d))

            # read the audit trail back THROUGH the live MCP (dashboard round-trip)
            log_r = await session.call_tool("get_audit_log", {"limit": 20})
            log = _result_list(log_r)
            if any(e.get("matched_policy") == "deny-prod-db-drop" for e in log) and \
               any(e.get("effect") == "allow" for e in log):
                ok(f"get_audit_log round-trips {len(log)} live decisions back from the dashboard")
            else:
                bad("audit log via MCP missing entries: " + json.dumps(log)[:200])

            # pending queue via the live MCP
            pend_r = await session.call_tool("list_pending", {})
            pend = _result_list(pend_r)
            if any(p.get("decision_id") == decision_id for p in pend):
                ok("list_pending shows the large payment awaiting approval")
            else:
                bad("pending not found via MCP")

            print("\nRESULT " + json.dumps({"decision_id": decision_id}))
    print("\nPHASE 9 LIVE CLIENT: " + ("FAILED" if failed else "PASSED"))
    return 1 if failed else 0


raise SystemExit(asyncio.run(main()))
