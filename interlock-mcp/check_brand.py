import asyncio
import os
from urllib.parse import quote

import truststore

truststore.inject_into_ssl()

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

URL = os.environ["BASE"] + "/mcp?key=" + quote(os.environ["TOK"], safe="")


async def main():
    async with streamablehttp_client(URL) as (r, w, _):
        async with ClientSession(r, w) as s:
            info = await s.initialize()
            print("server name:", info.serverInfo.name)
            tools = await s.list_tools()
            ra = next((t for t in tools.tools if t.name == "request_action"), None)
            desc = (ra.description or "").splitlines()[0] if ra else "(missing)"
            print("request_action desc:", desc)
            interlock = "interlock" in (info.serverInfo.name + " " + (ra.description or "")).lower()
            print("BRAND OK (no 'interlock'):", not interlock)


asyncio.run(main())
