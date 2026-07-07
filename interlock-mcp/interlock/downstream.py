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
from mcp.client.stdio import StdioServerParameters, get_default_environment, stdio_client
from mcp.client.streamable_http import streamablehttp_client


def _credentials(cfg: dict[str, Any]) -> dict[str, Any]:
    """Decode the credential bundle stored (encrypted) in cfg['auth'].

    Returns a dict that may contain:
      - 'env'     : {VAR: value} passed to a stdio server's process environment
      - 'bearer'  : a token sent as `Authorization: Bearer <token>` (http)
      - 'headers' : extra HTTP headers (http)
    Back-compat: a plain (non-JSON) decrypted string is treated as a bearer token.
    Empty/absent auth → {}.
    """
    auth = cfg.get("auth")
    if not auth:
        return {}
    if isinstance(auth, str) and auth.startswith("enc:"):
        from .crypto import decrypt_secret
        auth = decrypt_secret(auth)  # raises (fail closed) if the key is missing
    try:
        data = json.loads(auth)
    except (ValueError, TypeError):
        return {"bearer": auth}  # legacy single-token
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        return {"bearer": data}
    return {}


class Downstream:
    def __init__(self, cfg: dict[str, Any]):
        self._cfg = cfg

    @property
    def name(self) -> str:
        return self._cfg["name"]

    @asynccontextmanager
    async def _session(self) -> AsyncIterator[ClientSession]:
        creds = _credentials(self._cfg)
        if self._cfg["transport"] == "stdio":
            parts = json.loads(self._cfg["target"])
            # Pass the tool's credentials as process env vars, on top of a SAFE
            # minimal base (PATH etc.) — NOT the gateway's own os.environ, so the
            # downstream process never sees StileAI's secrets (INTERLOCK_ENC_KEY, …).
            cred_env = creds.get("env") or {}
            env = {**get_default_environment(), **cred_env} if cred_env else None
            params = StdioServerParameters(command=parts[0], args=parts[1:], env=env)
            async with stdio_client(params) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    yield session
        else:  # http
            headers: dict[str, str] = dict(creds.get("headers") or {})
            bearer = creds.get("bearer")
            if bearer:
                headers["Authorization"] = f"Bearer {bearer}"
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
