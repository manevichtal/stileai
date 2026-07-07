# interlock/downstream.py
"""Connect to ONE downstream MCP server (stdio or http) and list/call its tools.

Per-call connections: each method opens a fresh session, uses it, and closes it
within the caller's own task. This avoids anyio cross-task cancel-scope errors
that arise when a session opened in one task is used from another.
"""
from __future__ import annotations

import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from mcp import ClientSession, types
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp.client.streamable_http import streamablehttp_client


class Downstream:
    def __init__(self, cfg: dict[str, Any]):
        self._cfg = cfg

    @property
    def name(self) -> str:
        return self._cfg["name"]

    @asynccontextmanager
    async def _session(self) -> AsyncIterator[ClientSession]:
        if self._cfg["transport"] == "stdio":
            parts = json.loads(self._cfg["target"])
            params = StdioServerParameters(command=parts[0], args=parts[1:])
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session
        else:  # http
            headers: dict[str, str] = {}
            auth = self._cfg.get("auth")
            if auth:
                # Credentials are stored encrypted (enc:...). Decrypt just-in-time
                # before sending; fail closed if the key is unavailable rather than
                # sending a broken token.
                if auth.startswith("enc:"):
                    from .crypto import decrypt_secret
                    auth = decrypt_secret(auth)
                headers["Authorization"] = f"Bearer {auth}"
            async with streamablehttp_client(self._cfg["target"], headers=headers) as (
                read, write, _,
            ):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session

    async def list_tools(self) -> list[types.Tool]:
        async with self._session() as session:
            return (await session.list_tools()).tools

    async def call(self, tool: str, args: dict[str, Any]) -> types.CallToolResult:
        async with self._session() as session:
            return await session.call_tool(tool, args)
