"""Task 9: end-to-end proof that the enforced gateway (`INTERLOCK_MODE=gateway`)
actually gates a real MCP agent talking to the sample downstream tools server.

Connects an MCP client to the gateway's `/gw` endpoint (namespaced tools,
`sample__<tool>`), then drives all three effects:
  - allow            -> sample__read_data            (forwarded, performed=true)
  - deny             -> sample__delete_records        (blocked_by stileai, never runs)
  - require_approval -> sample__charge_card           (held; resolved out-of-band
                         via the dashboard's approvals API while the call blocks;
                         then forwarded, performed=true)
Finally confirms the dashboard's audit log recorded all three real actions.

Env vars:
  GW_BASE        gateway base URL, e.g. http://127.0.0.1:8791 (no trailing /gw)
  GW_TOKEN       the gateway's shared access token (INTERLOCK_MCP_AUTH_TOKEN)
  DASHBOARD_URL  the dashboard base URL, e.g. https://stileai.vercel.app
  API_KEY        the seeded sk_live_... api key (dashboard API auth)

Exit 0 and prints "GATEWAY E2E: ALL CHECKS PASSED" on success; on any failure
prints the specific failing check(s) and exits 1.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from urllib.parse import quote

# Use the OS trust store so TLS verifies behind this machine's corporate CA
# (test-harness only; production deployments use normal public TLS).
import truststore

truststore.inject_into_ssl()

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

GW_BASE = os.environ["GW_BASE"].rstrip("/")
GW_TOKEN = os.environ["GW_TOKEN"]
DASHBOARD_URL = os.environ["DASHBOARD_URL"].rstrip("/")
API_KEY = os.environ["API_KEY"]

GW_URL = f"{GW_BASE}/gw?key={quote(GW_TOKEN, safe='')}"
AUTH_HEADERS = {"Authorization": f"Bearer {API_KEY}"}

APPROVAL_POLL_TIMEOUT = 60.0  # seconds to wait for the pending charge_card to appear
APPROVAL_POLL_INTERVAL = 1.5
CHARGE_CALL_TIMEOUT = 90.0  # generous: bounds the held tool call itself

_failed = False


def ok(msg: str) -> None:
    print("  OK  " + msg)


def bad(msg: str) -> None:
    global _failed
    print("  BAD " + msg)
    _failed = True


def _payload(result):
    """CallToolResult.content -> first text block -> parsed JSON (or raw text)."""
    for block in result.content:
        text = getattr(block, "text", None)
        if text:
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                return text
    return None


async def _wait_for_pending_charge(http: httpx.AsyncClient) -> str | None:
    """Poll GET /api/approvals?status=pending until a charge_card row appears."""
    deadline = time.monotonic() + APPROVAL_POLL_TIMEOUT
    while time.monotonic() < deadline:
        r = await http.get(
            f"{DASHBOARD_URL}/api/approvals",
            params={"status": "pending"},
            headers=AUTH_HEADERS,
        )
        r.raise_for_status()
        for row in r.json():
            if row.get("action") == "charge_card":
                return row.get("decision_id")
        await asyncio.sleep(APPROVAL_POLL_INTERVAL)
    return None


async def _approve_pending_charge(http: httpx.AsyncClient) -> None:
    """Runs concurrently with the blocked sample__charge_card call: finds the
    pending approval and resolves it, unblocking the held tool call."""
    decision_id = await _wait_for_pending_charge(http)
    if decision_id is None:
        bad("no pending charge_card approval appeared within "
            f"{APPROVAL_POLL_TIMEOUT}s")
        return
    ok(f"found pending charge_card approval {decision_id[:12]}...")
    r = await http.post(
        f"{DASHBOARD_URL}/api/approvals/{decision_id}/resolve",
        headers=AUTH_HEADERS,
        json={"approver": "e2e", "approved": True},
    )
    r.raise_for_status()
    resolved = r.json()
    if resolved.get("status") == "approved":
        ok("resolved charge_card approval -> approved")
    else:
        bad("resolve did not report approved: " + json.dumps(resolved))


async def main() -> int:
    async with httpx.AsyncClient(timeout=30.0) as http:
        async with streamablehttp_client(GW_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                tools = await session.list_tools()
                names = {t.name for t in tools.tools}
                expected = {"sample__read_data", "sample__delete_records", "sample__charge_card"}
                if expected <= names:
                    ok(f"list_tools exposes the namespaced sample tools ({len(names)} total)")
                else:
                    bad("expected tools missing: " + str(expected - names))

                # --- allow path ------------------------------------------------
                read_result = await session.call_tool("sample__read_data", {"query": "x"})
                read_d = _payload(read_result)
                if isinstance(read_d, dict) and read_d.get("performed") is True:
                    ok("sample__read_data -> allowed, forwarded, performed=true")
                else:
                    bad("sample__read_data -> " + json.dumps(read_d))

                # --- deny path --------------------------------------------------
                delete_result = await session.call_tool(
                    "sample__delete_records", {"table": "customers", "where": "1=1"}
                )
                delete_d = _payload(delete_result)
                if (
                    isinstance(delete_d, dict)
                    and delete_d.get("blocked_by") == "stileai"
                    and delete_d.get("performed") is False
                ):
                    ok("sample__delete_records -> denied by stileai (real tool never ran)")
                else:
                    bad("sample__delete_records -> " + json.dumps(delete_d))

                # --- require_approval (hold) path -------------------------------
                # The charge_card call blocks server-side until approved/denied/
                # timed out. Concurrently poll + resolve it via the dashboard API,
                # exactly as an admin would from the UI.
                approver_task = asyncio.create_task(_approve_pending_charge(http))
                try:
                    charge_result = await asyncio.wait_for(
                        session.call_tool(
                            "sample__charge_card", {"customer": "c1", "amount": 4200}
                        ),
                        timeout=CHARGE_CALL_TIMEOUT,
                    )
                except asyncio.TimeoutError:
                    bad(f"sample__charge_card did not return within {CHARGE_CALL_TIMEOUT}s")
                    charge_result = None
                await approver_task

                if charge_result is not None:
                    charge_d = _payload(charge_result)
                    if isinstance(charge_d, dict) and charge_d.get("performed") is True:
                        ok("sample__charge_card -> held, approved out-of-band, "
                           "forwarded (performed=true)")
                    else:
                        bad("sample__charge_card -> " + json.dumps(charge_d))

        # --- audit trail ------------------------------------------------------
        audit_r = await http.get(
            f"{DASHBOARD_URL}/api/audit", params={"limit": 20}, headers=AUTH_HEADERS
        )
        audit_r.raise_for_status()
        rows = audit_r.json()
        actions_seen = {row.get("action") for row in rows}
        expected_actions = {"read_data", "delete_records", "charge_card"}
        if expected_actions <= actions_seen:
            ok(f"GET /api/audit has rows for read_data, delete_records, charge_card "
               f"({len(rows)} rows total)")
        else:
            bad("audit missing expected actions: "
                + json.dumps(sorted(expected_actions - actions_seen)))

    print("\nGATEWAY E2E: " + ("FAILED" if _failed else "ALL CHECKS PASSED"))
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
