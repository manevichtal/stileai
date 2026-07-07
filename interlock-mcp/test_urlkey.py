"""Verify the URL-key connect works: ?key=<token> (no header) connects; wrong key
rejected; Authorization header still works."""
import asyncio
import os
from urllib.parse import quote

import truststore

truststore.inject_into_ssl()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

BASE = os.environ["BASE"]
TOK = os.environ["TOK"]


async def connect(url, headers=None):
    async with streamablehttp_client(url, headers=headers or {}) as (r, w, _):
        async with ClientSession(r, w) as s:
            await s.initialize()
            t = await s.list_tools()
            return len(t.tools)


async def main():
    failed = False
    keyurl = f"{BASE}/mcp?key={quote(TOK, safe='')}"
    # 1) URL key, no header
    try:
        n = await connect(keyurl)
        print(f"  OK  connect via ?key= (no header) -> {n} tools")
    except Exception as e:
        print("  BAD ?key= connect failed:", str(e)[:120]); failed = True
    # 2) wrong key -> rejected
    try:
        await connect(f"{BASE}/mcp?key=wrong-token")
        print("  BAD wrong key connected"); failed = True
    except Exception:
        print("  OK  wrong ?key= rejected")
    # 3) Authorization header still works
    try:
        n = await connect(f"{BASE}/mcp", {"Authorization": f"Bearer {TOK}"})
        print(f"  OK  Authorization header still works -> {n} tools")
    except Exception as e:
        print("  BAD header connect failed:", str(e)[:120]); failed = True
    print("\nURL-KEY: " + ("FAILED" if failed else "PASSED"))
    raise SystemExit(1 if failed else 0)


asyncio.run(main())
